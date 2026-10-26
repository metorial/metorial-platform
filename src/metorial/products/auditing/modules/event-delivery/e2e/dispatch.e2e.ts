import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  dispatchSystemEventDelivery,
  eventDeliveryDispatchQueue,
  eventDeliveryService
} from '../src';
import {
  createDestination,
  createListener,
  createSystemEvent,
  intentsFor,
  waitForDelivery,
  waitForDestinations
} from './_fixtures';

describe('module-event-delivery: dispatch', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('delivers an event only to active destinations of its organization that subscribe to its type', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let eventType = uniqueId('e2e.dispatch');

    let subscribed = await createDestination(fixture, {
      retry: { strategy: 'linear', maxAttempts: 4, baseDelaySeconds: 7, maxDelaySeconds: 90 }
    });
    let subscribedListener = await createListener(fixture, subscribed, {
      eventTypes: [uniqueId('e2e.other'), eventType]
    });

    let archived = await createDestination(fixture, { status: 'archived' });
    await createListener(fixture, archived, { eventTypes: [eventType] });

    let unsubscribed = await createDestination(fixture);
    await createListener(fixture, unsubscribed, { eventTypes: [uniqueId('e2e.other')] });

    let emptyListener = await createDestination(fixture);
    await createListener(fixture, emptyListener, { eventTypes: [] });

    let wrongType = await createDestination(fixture);
    await createListener(fixture, wrongType, { type: 'chat', eventTypes: [eventType] });

    let otherTenant = await createDestination(otherFixture);
    await createListener(otherFixture, otherTenant, { eventTypes: [eventType] });

    let systemEvent = await createSystemEvent(fixture, { eventType, payload: { ok: true } });
    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });

    let [intent] = await waitForDestinations(systemEvent, [subscribed.id]);
    expect(intent).toMatchObject({
      type: 'webhook',
      retryStrategy: 'linear',
      retryMaxAttempts: 4,
      retryBaseDelaySeconds: 7,
      retryMaxDelaySeconds: 90,
      eventDestinationListenerOid: subscribedListener.oid,
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid
    });

    expect(
      await db.eventDeliveryIntent.count({
        where: {
          organizationOid: otherFixture.organization.oid,
          systemEventOid: systemEvent.oid
        }
      })
    ).toBe(0);
  });

  it('delivers an organization-level event to listeners on any instance of the organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let eventType = uniqueId('e2e.org-level');

    let destination = await createDestination(fixture);
    await createListener(fixture, destination, { eventTypes: [eventType] });

    let systemEvent = await createSystemEvent(fixture, { eventType, organizationLevel: true });
    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });

    let [intent] = await waitForDestinations(systemEvent, [destination.id]);
    expect(intent!.instanceOid).toBeNull();

    let byInstance = await firstPage(
      await eventDeliveryService.listEventDeliveries({
        organization: fixture.organization,
        eventIds: [systemEvent.id],
        instanceIds: [org.ids.instanceId]
      })
    );
    expect(byInstance.map(item => item.id)).toEqual([intent!.id]);
  });

  it('creates one delivery per destination however many listeners match, even when the dispatch runs again', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let eventType = uniqueId('e2e.idempotent');

    let twoListeners = await createDestination(fixture);
    await createListener(fixture, twoListeners, { eventTypes: [eventType] });
    await createListener(fixture, twoListeners, {
      eventTypes: [eventType, uniqueId('e2e.x')]
    });
    let oneListener = await createDestination(fixture);
    await createListener(fixture, oneListener, { eventTypes: [eventType] });

    let systemEvent = await createSystemEvent(fixture, { eventType });
    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });
    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });

    let first = await waitForDestinations(systemEvent, [twoListeners.id, oneListener.id]);
    for (let intent of first) {
      await waitForDelivery(fixture, intent.id, { status: 'failed', attemptCount: 1 });
    }

    let lateDestination = await createDestination(fixture);
    await createListener(fixture, lateDestination, { eventTypes: [eventType] });
    await eventDeliveryDispatchQueue.add(
      { systemEventId: systemEvent.id },
      { id: uniqueId('e2e-redispatch') }
    );

    let second = await waitForDestinations(systemEvent, [
      twoListeners.id,
      oneListener.id,
      lateDestination.id
    ]);
    let late = second.find(intent => intent.eventDestination.id == lateDestination.id)!;
    await waitForDelivery(fixture, late.id, { status: 'failed', attemptCount: 1 });

    let final = await intentsFor(systemEvent);
    expect(final).toHaveLength(3);
    for (let intent of first) {
      let again = final.find(item => item.id == intent.id)!;
      expect(again.attempts.map(attempt => attempt.attemptNumber)).toEqual([1]);
    }
  }, 180_000);

  it('matches callback events by callback, provider and trigger key', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let callbackId = uniqueId('clb');
    let providerId = uniqueId('prv');

    let allCallbacks = await createDestination(fixture);
    await createListener(fixture, allCallbacks, { type: 'callback' });

    let byCallbackAndTrigger = await createDestination(fixture);
    await createListener(fixture, byCallbackAndTrigger, {
      type: 'callback',
      callbackId,
      triggers: ['issue.created']
    });

    let byProvider = await createDestination(fixture);
    await createListener(fixture, byProvider, { type: 'callback', providerId });

    let otherCallback = await createDestination(fixture);
    await createListener(fixture, otherCallback, {
      type: 'callback',
      callbackId: uniqueId('clb')
    });

    let eventTypeListener = await createDestination(fixture);
    await createListener(fixture, eventTypeListener, {
      type: 'event',
      eventTypes: ['callback.issue.created']
    });

    let created = await createSystemEvent(fixture, {
      source: 'callback',
      eventType: 'callback.issue.created',
      callbackId,
      callbackTriggerKey: 'issue.created',
      providerId
    });
    await dispatchSystemEventDelivery({ systemEventId: created.id });
    await waitForDestinations(created, [
      allCallbacks.id,
      byCallbackAndTrigger.id,
      byProvider.id
    ]);

    let closed = await createSystemEvent(fixture, {
      source: 'callback',
      eventType: 'callback.issue.closed',
      callbackId,
      callbackTriggerKey: 'issue.closed',
      providerId: uniqueId('prv')
    });
    await dispatchSystemEventDelivery({ systemEventId: closed.id });
    await waitForDestinations(closed, [allCallbacks.id]);
  });

  it('matches chat events by connection, provider and event type', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let chatConnectionId = uniqueId('chc');
    let providerId = uniqueId('prv');

    let allConnections = await createDestination(fixture);
    await createListener(fixture, allConnections, {
      type: 'chat',
      eventTypes: ['chat.message.received']
    });

    let byConnection = await createDestination(fixture);
    await createListener(fixture, byConnection, {
      type: 'chat',
      chatConnectionId,
      eventTypes: ['chat.message.received', 'chat.reaction.added']
    });

    let byProvider = await createDestination(fixture);
    await createListener(fixture, byProvider, {
      type: 'chat',
      providerId,
      eventTypes: ['chat.message.received']
    });

    let otherProvider = await createDestination(fixture);
    await createListener(fixture, otherProvider, {
      type: 'chat',
      providerId: uniqueId('prv'),
      eventTypes: ['chat.message.received']
    });

    let otherType = await createDestination(fixture);
    await createListener(fixture, otherType, {
      type: 'chat',
      eventTypes: ['chat.member.joined']
    });

    let message = await createSystemEvent(fixture, {
      source: 'chat',
      eventType: 'chat.message.received',
      chatConnectionId,
      providerId
    });
    await dispatchSystemEventDelivery({ systemEventId: message.id });
    await waitForDestinations(message, [allConnections.id, byConnection.id, byProvider.id]);

    let reaction = await createSystemEvent(fixture, {
      source: 'chat',
      eventType: 'chat.reaction.added',
      chatConnectionId,
      providerId
    });
    await dispatchSystemEventDelivery({ systemEventId: reaction.id });
    await waitForDestinations(reaction, [byConnection.id]);
  });
});
