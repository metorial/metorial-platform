import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { eventDestinationListenerService, eventDestinationService } from '../src';

type ListenerInput = Parameters<
  typeof eventDestinationListenerService.createEventDestinationListener
>[0]['input'];

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

let createDestination = (fixture: OrganizationFixture) =>
  eventDestinationService.createEventDestination({
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: {
      name: uniqueId('destination'),
      type: 'webhook',
      webhook: { url: `https://example.com/webhooks/${uniqueId('hook')}` }
    }
  });

let createListener = (
  fixture: OrganizationFixture,
  destination: { id: string },
  input: DistributiveOmit<ListenerInput, 'eventDestinationId'>
) =>
  eventDestinationListenerService.createEventDestinationListener({
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { ...input, eventDestinationId: destination.id } as ListenerInput
  });

let listListenerIds = async (
  fixture: OrganizationFixture,
  input: Omit<
    Parameters<typeof eventDestinationListenerService.listEventDestinationListeners>[0],
    'organization'
  > = {}
) =>
  (
    await firstPage(
      await eventDestinationListenerService.listEventDestinationListeners({
        organization: fixture.organization,
        ...input
      })
    )
  ).map(item => item.id);

let listDestinationIds = async (
  fixture: OrganizationFixture,
  input: { callbackIds?: string[]; chatConnectionIds?: string[] }
) =>
  (
    await firstPage(
      await eventDestinationService.listEventDestinations({
        organization: fixture.organization,
        ...input
      })
    )
  ).map(item => item.id);

describe('module-event-destination: listeners', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates, updates and deletes an event listener and persists its subscription', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture);

    let listener = await createListener(fixture, destination, {
      type: 'event',
      eventTypes: ['organization.created']
    });
    expect(listener).toMatchObject({
      type: 'event',
      eventTypes: ['organization.created'],
      triggers: [],
      callbackId: null,
      chatConnectionId: null,
      providerId: null
    });

    let row = await db.eventDestinationListener.findUniqueOrThrow({
      where: { id: listener.id }
    });
    expect(row).toMatchObject({
      instanceOid: fixture.instance.oid,
      eventDestinationOid: destination.oid,
      eventTypes: ['organization.created']
    });

    let withListeners = await eventDestinationService.getEventDestinationById({
      organization: fixture.organization,
      eventDestinationId: destination.id
    });
    expect(withListeners.listeners.map(item => item.id)).toEqual([listener.id]);
    expect(withListeners.listeners[0]!.instance.id).toBe(org.ids.instanceId);

    let updated = await eventDestinationListenerService.updateEventDestinationListener({
      instance: fixture.instance,
      listener,
      auditScope: fixture.auditScope,
      input: { eventTypes: [] }
    });
    expect(updated.eventTypes).toEqual([]);
    expect(
      (await db.eventDestinationListener.findUniqueOrThrow({ where: { id: listener.id } }))
        .eventTypes
    ).toEqual([]);

    await expectServiceError(
      eventDestinationListenerService.updateEventDestinationListener({
        instance: fixture.instance,
        listener: updated,
        auditScope: fixture.auditScope,
        input: { eventTypes: ['organization.created', 'e2e.not_a_real_event'] }
      }),
      'bad_request'
    );

    await eventDestinationListenerService.deleteEventDestinationListener({
      instance: fixture.instance,
      listener: updated,
      auditScope: fixture.auditScope
    });
    expect(await db.eventDestinationListener.count({ where: { id: listener.id } })).toBe(0);
    await expectServiceError(
      eventDestinationListenerService.getEventDestinationListenerById({
        organization: fixture.organization,
        eventDestinationListenerId: listener.id
      }),
      'not_found'
    );
  });

  it('only accepts declared event types for event and chat listeners', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture);

    let unknownEvent = await expectServiceError(
      createListener(fixture, destination, {
        type: 'event',
        eventTypes: ['organization.created', 'e2e.not_a_real_event']
      }),
      'bad_request'
    );
    expect(unknownEvent.message).toContain('e2e.not_a_real_event');

    await expectServiceError(
      createListener(fixture, destination, {
        type: 'event',
        eventTypes: ['chat.message.received']
      }),
      'bad_request'
    );
    await expectServiceError(
      createListener(fixture, destination, {
        type: 'chat',
        eventTypes: ['organization.created']
      }),
      'bad_request'
    );

    let chat = await createListener(fixture, destination, {
      type: 'chat',
      eventTypes: ['chat.message.received', 'chat.mention.received']
    });
    expect(chat).toMatchObject({
      type: 'chat',
      eventTypes: ['chat.message.received', 'chat.mention.received'],
      chatConnectionId: null,
      providerId: null
    });

    await expectServiceError(
      eventDestinationListenerService.updateEventDestinationListener({
        instance: fixture.instance,
        listener: chat,
        auditScope: fixture.auditScope,
        input: { eventTypes: ['organization.created'] }
      }),
      'bad_request'
    );

    expect(
      await db.eventDestinationListener.count({
        where: { eventDestinationOid: destination.oid }
      })
    ).toBe(1);
  });

  it('rejects listeners that name both a specific target and a provider', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture);

    await expectServiceError(
      createListener(fixture, destination, {
        type: 'callback',
        callbackId: uniqueId('clb'),
        providerId: uniqueId('prv'),
        triggers: []
      }),
      'bad_request'
    );
    await expectServiceError(
      createListener(fixture, destination, {
        type: 'chat',
        chatConnectionId: uniqueId('chc'),
        providerId: uniqueId('prv'),
        eventTypes: ['chat.message.received']
      }),
      'bad_request'
    );

    let catchAll = await createListener(fixture, destination, {
      type: 'callback',
      triggers: []
    });
    expect(catchAll).toMatchObject({
      type: 'callback',
      callbackId: null,
      providerId: null,
      triggers: [],
      eventTypes: []
    });
  });

  it('refuses listeners on archived destinations and stops listing their listeners', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture);
    let listener = await createListener(fixture, destination, {
      type: 'event',
      eventTypes: ['organization.created']
    });

    await eventDestinationService.archiveEventDestination({
      organization: fixture.organization,
      eventDestination: destination,
      auditScope: fixture.auditScope
    });

    await expectServiceError(
      createListener(fixture, destination, {
        type: 'event',
        eventTypes: ['organization.created']
      }),
      'bad_request'
    );
    expect(await listListenerIds(fixture, { eventDestinationIds: [destination.id] })).toEqual(
      []
    );

    let fetched = await eventDestinationListenerService.getEventDestinationListenerById({
      organization: fixture.organization,
      eventDestinationListenerId: listener.id
    });
    expect(fetched.eventDestination.status).toBe('archived');
  });

  it("never attaches a listener to another organization's destination", async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let destination = await createDestination(fixture);
    let listener = await createListener(fixture, destination, {
      type: 'event',
      eventTypes: ['organization.created']
    });

    await expectServiceError(
      eventDestinationListenerService.createEventDestinationListener({
        instance: otherFixture.instance,
        auditScope: otherFixture.auditScope,
        input: {
          eventDestinationId: destination.id,
          type: 'event',
          eventTypes: ['organization.created']
        }
      }),
      'not_found'
    );
    expect(
      await db.eventDestinationListener.count({
        where: { eventDestinationOid: destination.oid }
      })
    ).toBe(1);

    await expectServiceError(
      eventDestinationListenerService.getEventDestinationListenerById({
        organization: otherFixture.organization,
        eventDestinationListenerId: listener.id
      }),
      'not_found'
    );
    expect(await listListenerIds(otherFixture)).not.toContain(listener.id);
    expect(
      await listListenerIds(otherFixture, { eventDestinationIds: [destination.id] })
    ).toEqual([]);
  });

  it('filters listeners by destination, instance and type', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture);
    let eventListener = await createListener(fixture, destination, {
      type: 'event',
      eventTypes: ['organization.created']
    });
    let chatListener = await createListener(fixture, destination, {
      type: 'chat',
      eventTypes: ['chat.message.received']
    });

    let byDestination = await listListenerIds(fixture, {
      eventDestinationIds: [destination.id]
    });
    expect(byDestination.sort()).toEqual([eventListener.id, chatListener.id].sort());

    expect(
      await listListenerIds(fixture, {
        eventDestinationIds: [destination.id],
        types: ['chat']
      })
    ).toEqual([chatListener.id]);
    expect(
      await listListenerIds(fixture, {
        eventDestinationIds: [destination.id],
        instanceIds: [org.ids.instanceId]
      })
    ).toHaveLength(2);
    expect(
      await listListenerIds(fixture, {
        eventDestinationIds: [destination.id],
        instanceIds: [otherOrg.ids.instanceId]
      })
    ).toEqual([]);
  });

  it('matches catch-all callback and chat listeners when filtering by callback or chat connection', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let callbackOnly = await createDestination(fixture);
    let both = await createDestination(fixture);
    let eventOnly = await createDestination(fixture);

    let callbackListener = await createListener(fixture, callbackOnly, {
      type: 'callback',
      triggers: []
    });
    await createListener(fixture, both, { type: 'callback', triggers: [] });
    await createListener(fixture, both, {
      type: 'chat',
      eventTypes: ['chat.message.received']
    });
    let eventListener = await createListener(fixture, eventOnly, {
      type: 'event',
      eventTypes: ['organization.created']
    });

    let callbackIds = [uniqueId('clb')];
    let chatConnectionIds = [uniqueId('chc')];

    let byCallback = await listDestinationIds(fixture, { callbackIds });
    expect(byCallback).toEqual(expect.arrayContaining([callbackOnly.id, both.id]));
    expect(byCallback).not.toContain(eventOnly.id);

    let byBoth = await listDestinationIds(fixture, { callbackIds, chatConnectionIds });
    expect(byBoth).toContain(both.id);
    expect(byBoth).not.toContain(callbackOnly.id);
    expect(byBoth).not.toContain(eventOnly.id);

    let listenersByCallback = await listListenerIds(fixture, { callbackIds });
    expect(listenersByCallback).toContain(callbackListener.id);
    expect(listenersByCallback).not.toContain(eventListener.id);
  });
});
