import { describe, expect, it } from 'vitest';
import {
  applyCreatedListenerDraft,
  CHAT_EVENT_CATALOG,
  createListenerDraft,
  getCallbackTriggersLoading,
  getEventSelectionMode,
  getListenerDraftOperations,
  getListenerScopeSummary,
  getUncreatedListenerDrafts,
  listenerDraftCanSubmit,
  listenerDraftToCreateBody,
  listenerToDraft
} from './listenerEditor';

describe('listener draft editor', () => {
  it('keeps the frontend chat event catalog aligned with accepted backend keys', () => {
    expect(CHAT_EVENT_CATALOG.map(event => event.id)).toEqual([
      'chat.message.received',
      'chat.message.updated',
      'chat.message.deleted',
      'chat.mention.received',
      'chat.reaction.added',
      'chat.reaction.removed',
      'chat.command.invoked',
      'chat.member.joined',
      'chat.member.left'
    ]);
  });

  it('maps backend event listeners to system drafts', () => {
    let draft = listenerToDraft({
      id: 'listener-id',
      object: 'event.destination_listener',
      instanceId: 'instance-id',
      eventDestinationId: 'destination-id',
      type: 'event',
      eventTypes: ['session.created'],
      callbackId: null,
      triggers: null,
      chatConnectionId: null,
      providerId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    expect(draft).toMatchObject({
      id: 'listener-id',
      type: 'system',
      scope: 'all',
      targetId: null,
      eventKeys: ['session.created']
    });
  });

  it('does not keep all-callback triggers loading after the trigger request finishes', () => {
    expect(
      getCallbackTriggersLoading({
        scope: 'all',
        targetId: null,
        triggerProviderId: null,
        providerVersionId: null,
        targetLoading: true,
        providerLoading: true,
        providerTriggersLoading: false
      })
    ).toBe(false);
  });

  it('waits for a provider version before loading scoped triggers', () => {
    expect(
      getCallbackTriggersLoading({
        scope: 'provider',
        targetId: 'provider-id',
        triggerProviderId: 'provider-id',
        providerVersionId: null,
        targetLoading: false,
        providerLoading: true,
        providerTriggersLoading: true
      })
    ).toBe(true);
    expect(
      getCallbackTriggersLoading({
        scope: 'provider',
        targetId: null,
        triggerProviderId: null,
        providerVersionId: null,
        targetLoading: false,
        providerLoading: true,
        providerTriggersLoading: true
      })
    ).toBe(false);
  });

  it('derives all vs custom from the current event selection', () => {
    expect(
      getEventSelectionMode(
        [{ id: 'issue.created' }, { id: 'issue.updated' }],
        ['issue.created', 'issue.updated']
      )
    ).toBe('all');
    expect(
      getEventSelectionMode([{ id: 'issue.created' }, { id: 'issue.updated' }], [
        'issue.created'
      ])
    ).toBe('custom');
  });

  it('summarizes provider-scoped drafts with provider names', () => {
    let draft = createListenerDraft({
      type: 'callback',
      scope: 'provider',
      targetId: 'provider-id'
    });

    expect(
      getListenerScopeSummary(draft, {
        providers: [{ id: 'provider-id', label: 'Linear' }]
      })
    ).toBe('All Linear callbacks');
  });

  it('requires events and a target for scoped listeners', () => {
    expect(listenerDraftCanSubmit(createListenerDraft())).toBe(false);
    expect(
      listenerDraftCanSubmit(
        createListenerDraft({
          scope: 'provider',
          targetId: null,
          eventKeys: ['issue.created']
        })
      )
    ).toBe(false);
    expect(
      listenerDraftCanSubmit(
        createListenerDraft({
          scope: 'provider',
          targetId: 'provider-id',
          eventKeys: ['issue.created']
        })
      )
    ).toBe(true);
  });

  it('maps listener drafts to create mutation bodies', () => {
    let draft = createListenerDraft({
      type: 'chat',
      scope: 'specific',
      targetId: 'connection-id',
      eventKeys: ['chat.message.received']
    });

    expect(listenerDraftToCreateBody(draft, 'instance-id', 'destination-id')).toEqual({
      instanceId: 'instance-id',
      eventDestinationId: 'destination-id',
      type: 'chat',
      chatConnectionId: 'connection-id',
      eventTypes: ['chat.message.received']
    });
  });

  it('excludes listeners already created by an earlier attempt', () => {
    let first = createListenerDraft({ id: 'first' });
    let second = createListenerDraft({ id: 'second' });

    expect(getUncreatedListenerDrafts([first, second], new Set(['first']))).toEqual([second]);
  });

  it('updates event selections without recreating an unchanged listener scope', () => {
    let original = createListenerDraft({
      id: 'listener-id',
      type: 'callback',
      scope: 'provider',
      targetId: 'provider-id',
      eventKeys: ['issue.created']
    });
    let changed = { ...original, eventKeys: ['issue.created', 'issue.updated'] };

    expect(getListenerDraftOperations([original], [changed])).toEqual([
      { type: 'update', listenerId: 'listener-id', draft: changed }
    ]);
    expect(getListenerDraftOperations([original], [{ ...original }])).toEqual([]);
  });

  it('replaces listeners only when their scope changes', () => {
    let original = createListenerDraft({
      id: 'listener-id',
      type: 'chat',
      scope: 'all',
      eventKeys: ['chat.message.received']
    });
    let changed = { ...original, scope: 'provider' as const, targetId: 'provider-id' };

    expect(getListenerDraftOperations([original], [changed])).toEqual([
      { type: 'replace', listenerId: 'listener-id', draft: changed }
    ]);
  });

  it('retries only the old-listener deletion after a replacement was created', () => {
    let original = createListenerDraft({
      id: 'old-listener',
      type: 'chat',
      scope: 'all',
      eventKeys: ['chat.message.received']
    });
    let desired = {
      ...original,
      scope: 'provider' as const,
      targetId: 'provider-id'
    };
    let created = { ...desired, id: 'new-listener' };

    let checkpoint = applyCreatedListenerDraft([original], [desired], original.id, created);

    expect(checkpoint.nextDrafts).toEqual([created]);
    expect(getListenerDraftOperations(checkpoint.savedDrafts, checkpoint.nextDrafts)).toEqual([
      { type: 'delete', listenerId: 'old-listener' }
    ]);
  });
});
