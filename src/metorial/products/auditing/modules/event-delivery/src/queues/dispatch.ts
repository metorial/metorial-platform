import { db, EventDestination, EventDestinationListener, ID, SystemEvent } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { attemptDeliveryQueue } from './attempt';

export let eventDeliveryDispatchQueue = createQueue<{ systemEventId: string }>({
  name: 'auditing/eventDelivery/dispatch',
  workerOpts: { concurrency: 5 }
});

export let dispatchSystemEventDelivery = async (d: { systemEventId: string }) => {
  await eventDeliveryDispatchQueue.add(
    { systemEventId: d.systemEventId },
    { id: `event-delivery-dispatch:${d.systemEventId}` }
  );
};

export let matchesListener = (
  event: SystemEvent,
  listener: EventDestinationListener & { eventDestination: EventDestination }
) => {
  if (listener.eventDestination.status != 'active') return false;

  if (event.source == 'callback') {
    if (listener.type != 'callback') return false;
    if (listener.callbackId != event.callbackId) return false;

    // No trigger filter means every trigger on that callback.
    if (listener.triggers.length == 0) return true;
    return (
      event.callbackTriggerKey != null && listener.triggers.includes(event.callbackTriggerKey)
    );
  }

  if (event.source == 'chat') {
    if (listener.type != 'chat') return false;
    if (listener.chatIntegrationId != event.chatIntegrationId) return false;
    return listener.eventTypes.includes(event.eventType);
  }

  if (listener.type != 'event') return false;
  return listener.eventTypes.includes(event.eventType);
};

export let eventDeliveryDispatchQueueProcessor = eventDeliveryDispatchQueue.process(
  async data => {
    let event = await db.systemEvent.findUnique({ where: { id: data.systemEventId } });
    if (!event) throw new QueueRetryError();

    let listeners = await db.eventDestinationListener.findMany({
      where: {
        // An event without an instance (an organization-level event) is offered to every listener
        // in the organization; an instance-scoped event only to that instance's listeners.
        instanceOid: event.instanceOid ?? undefined,
        eventDestination: {
          organizationOid: event.organizationOid,
          status: 'active'
        }
      },
      include: { eventDestination: true }
    });

    let matching = listeners.filter(listener => matchesListener(event, listener));
    if (matching.length == 0) return;

    // Two listeners in the same organization can point at one destination; the destination should
    // still only receive the event once.
    let byDestination = new Map<bigint, (typeof matching)[number]>();
    for (let listener of matching) {
      if (!byDestination.has(listener.eventDestinationOid)) {
        byDestination.set(listener.eventDestinationOid, listener);
      }
    }

    await db.eventDeliveryIntent.createMany({
      data: await Promise.all(
        [...byDestination.values()].map(async listener => ({
          id: await ID.generateId('eventDeliveryIntent'),
          status: 'pending' as const,
          type: listener.eventDestination.type,
          retryStrategy: listener.eventDestination.retryStrategy,
          retryMaxAttempts: listener.eventDestination.retryMaxAttempts,
          retryBaseDelaySeconds: listener.eventDestination.retryBaseDelaySeconds,
          retryMaxDelaySeconds: listener.eventDestination.retryMaxDelaySeconds,
          systemEventOid: event.oid,
          eventDestinationOid: listener.eventDestinationOid,
          eventDestinationListenerOid: listener.oid,
          organizationOid: event.organizationOid,
          instanceOid: event.instanceOid,
          nextAttemptAt: new Date()
        }))
      ),
      // A redelivered dispatch job must not schedule the same event to the same destination twice.
      skipDuplicates: true
    });

    let intents = await db.eventDeliveryIntent.findMany({
      where: { systemEventOid: event.oid, status: 'pending', attemptCount: 0 },
      select: { id: true }
    });
    if (intents.length == 0) return;

    await attemptDeliveryQueue.addManyWithOps(
      intents.map(intent => ({
        data: { intentId: intent.id, attemptNumber: 1 },
        opts: { id: `event-delivery-attempt:${intent.id}:1` }
      }))
    );
  }
);
