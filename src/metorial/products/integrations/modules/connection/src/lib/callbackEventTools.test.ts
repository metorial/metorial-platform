import { beforeEach, describe, expect, it, vi } from 'vitest';

let callbackEventService = vi.hoisted(() => ({
  listCallbackEventsInternal: vi.fn(),
  getCallbackEventByIdInternal: vi.fn(),
  markCallbackEventsReadInternal: vi.fn()
}));

let db = vi.hoisted(() => ({
  environment: { findUniqueOrThrow: vi.fn(async () => ({ oid: 7n, id: 'env_1' })) },
  sessionTemplateProvider: { findMany: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial-subspace/module-callback', () => ({ callbackEventService }));
vi.mock('@metorial-subspace/module-provider-internal', () => ({}));
vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: vi.fn()
}));

import { ServiceError } from '@lowerdeck/error';
import {
  buildCallbackEventTools,
  GET_CALLBACK_EVENT_TOOL_KEY,
  isCallbackEventTool,
  LIST_CALLBACK_EVENTS_TOOL_KEY,
  MARK_CALLBACK_EVENTS_READ_TOOL_KEY,
  resolveCallbackEventToolScope,
  runCallbackEventTool
} from './callbackEventTools';

let session = { id: 'ses_1', environmentOid: 7n } as any;
let tenant = { oid: 1n, id: 'ten_1' } as any;
let scope = { integrationProviderIds: ['inp_1'] };
let sessionProviders = [
  { fromTemplateProviderOid: 100n },
  { fromTemplateProviderOid: 101n },
  { fromTemplateProviderOid: null }
];

let event = {
  id: 'cbe_1',
  status: 'processed',
  source: 'webhook',
  providerTriggerKey: 'repository.pushed',
  mappedType: null,
  mappedId: null,
  callback: { id: 'cbk_1', name: 'Pushes', provider: { id: 'prv_1', name: 'GitHub' } },
  occurredAt: new Date('2026-01-10T14:45:00Z'),
  readAt: null,
  createdAt: new Date('2026-01-10T14:45:01Z')
};

describe('callback event tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds three metorial tools owned by the session', () => {
    let tools = buildCallbackEventTools(session);

    expect(tools.map(t => t.key)).toEqual([
      LIST_CALLBACK_EVENTS_TOOL_KEY,
      GET_CALLBACK_EVENT_TOOL_KEY,
      MARK_CALLBACK_EVENTS_READ_TOOL_KEY
    ]);
    expect(tools.every(t => isCallbackEventTool(t.key))).toBe(true);
    expect(isCallbackEventTool('github_list_issues')).toBe(false);
  });

  it('only offers the tools for integrations that enabled them', async () => {
    await expect(resolveCallbackEventToolScope([])).resolves.toBeNull();
    await expect(
      resolveCallbackEventToolScope([{ fromTemplateProviderOid: null }])
    ).resolves.toBeNull();
    expect(db.sessionTemplateProvider.findMany).not.toHaveBeenCalled();

    db.sessionTemplateProvider.findMany.mockResolvedValueOnce([
      {
        integrationInstanceProvider: {
          integrationProvider: { id: 'inp_1' },
          integration: { enableCallbackTools: false }
        },
        integrationInstanceGroupProvider: null
      }
    ]);
    await expect(resolveCallbackEventToolScope(sessionProviders)).resolves.toBeNull();

    db.sessionTemplateProvider.findMany.mockResolvedValueOnce([
      {
        integrationInstanceProvider: {
          integrationProvider: { id: 'inp_1' },
          integration: { enableCallbackTools: true }
        },
        integrationInstanceGroupProvider: null
      },
      {
        integrationInstanceProvider: null,
        integrationInstanceGroupProvider: {
          integrationProvider: { id: 'inp_2' },
          integration: { enableCallbackTools: true }
        }
      },
      {
        integrationInstanceProvider: {
          integrationProvider: { id: 'inp_3' },
          integration: { enableCallbackTools: false }
        },
        integrationInstanceGroupProvider: null
      }
    ]);
    await expect(resolveCallbackEventToolScope(sessionProviders)).resolves.toEqual({
      integrationProviderIds: ['inp_1', 'inp_2']
    });
    expect(db.sessionTemplateProvider.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { oid: { in: [100n, 101n] } } })
    );
  });

  it('lists unread events of the linked providers newest first by default', async () => {
    let run = vi.fn(async () => ({ items: [event], pagination: { hasNextPage: true } }));
    callbackEventService.listCallbackEventsInternal.mockResolvedValue({ run });

    let output = await runCallbackEventTool({
      toolKey: LIST_CALLBACK_EVENTS_TOOL_KEY,
      arguments: { callback_id: 'cbk_1' },
      tenant,
      session,
      scope
    });

    expect(callbackEventService.listCallbackEventsInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackIds: ['cbk_1'],
        integrationProviderIds: ['inp_1'],
        unread: true
      })
    );
    expect(run).toHaveBeenCalledWith({ after: undefined, limit: 25, order: 'desc' });
    expect(output).toEqual({
      events: [
        expect.objectContaining({ id: 'cbe_1', callback: event.callback, read_at: null })
      ],
      has_more: true,
      next_cursor: 'cbe_1'
    });
  });

  it('can page through already-read events without marking anything read', async () => {
    let run = vi
      .fn()
      .mockResolvedValueOnce({
        items: [event],
        pagination: { hasNextPage: true }
      })
      .mockResolvedValueOnce({
        items: [{ ...event, id: 'cbe_older' }],
        pagination: { hasNextPage: false }
      });
    callbackEventService.listCallbackEventsInternal.mockResolvedValue({ run });

    let first = await runCallbackEventTool({
      toolKey: LIST_CALLBACK_EVENTS_TOOL_KEY,
      arguments: { limit: 1, unread_only: false },
      tenant,
      session,
      scope
    });
    let second = await runCallbackEventTool({
      toolKey: LIST_CALLBACK_EVENTS_TOOL_KEY,
      arguments: { limit: 1, unread_only: false, after: first.next_cursor },
      tenant,
      session,
      scope
    });

    expect(run).toHaveBeenLastCalledWith({ after: 'cbe_1', limit: 1, order: 'desc' });
    expect(callbackEventService.listCallbackEventsInternal).toHaveBeenLastCalledWith(
      expect.objectContaining({ unread: false, integrationProviderIds: ['inp_1'] })
    );
    expect(second.events[0].id).toBe('cbe_older');
    expect(second.next_cursor).toBeNull();
    expect(second.has_more).toBe(false);
    expect(callbackEventService.markCallbackEventsReadInternal).not.toHaveBeenCalled();
  });

  it('returns the payload for a single event', async () => {
    callbackEventService.getCallbackEventByIdInternal.mockResolvedValue({
      ...event,
      details: {
        status: 'succeeded',
        payload: { action: 'opened' },
        error: null,
        webhook: null
      }
    });

    let output = await runCallbackEventTool({
      toolKey: GET_CALLBACK_EVENT_TOOL_KEY,
      arguments: { callback_event_id: 'cbe_1' },
      tenant,
      session,
      scope
    });

    expect(callbackEventService.getCallbackEventByIdInternal).toHaveBeenCalledWith(
      expect.objectContaining({ callbackEventId: 'cbe_1', integrationProviderIds: ['inp_1'] })
    );
    expect(output.event).toMatchObject({ id: 'cbe_1', payload: { action: 'opened' } });
  });

  it('reports which ids were marked read and which were skipped', async () => {
    callbackEventService.markCallbackEventsReadInternal.mockResolvedValue({
      markedIds: ['cbe_1']
    });

    let output = await runCallbackEventTool({
      toolKey: MARK_CALLBACK_EVENTS_READ_TOOL_KEY,
      arguments: { callback_event_ids: ['cbe_1', 'cbe_other'] },
      tenant,
      session,
      scope
    });

    expect(callbackEventService.markCallbackEventsReadInternal).toHaveBeenCalledWith(
      expect.objectContaining({ integrationProviderIds: ['inp_1'] })
    );
    expect(output).toEqual({ marked_read_ids: ['cbe_1'], skipped_ids: ['cbe_other'] });
  });

  it('rejects invalid input', async () => {
    await expect(
      runCallbackEventTool({
        toolKey: GET_CALLBACK_EVENT_TOOL_KEY,
        arguments: {},
        tenant,
        session,
        scope
      })
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
