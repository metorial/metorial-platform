import { db, EventDestination, EventDestinationListener, ID, SystemEvent } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { attemptDeliveryQueue } from './attempt';

let dispatchBatchSize = 500;

export let eventDeliveryDispatchQueue = createQueue<{
  systemEventId: string;
  cursor?: string;
}>({
  name: 'auditing/eventDelivery/dispatch',
  workerOpts: { concurrency: 5 }
});

export let dispatchSystemEventDelivery = async (d: { systemEventId: string }) => {
  await eventDeliveryDispatchQueue.add(
    { systemEventId: d.systemEventId },
    { id: `event-delivery-dispatch:${d.systemEventId}` }
  );
};

let matchesCallbackTarget = (event: SystemEvent, listener: EventDestinationListener) => {
  if (listener.callbackId != null) return listener.callbackId == event.callbackId;
  if (listener.providerId != null) {
    return event.providerId != null && listener.providerId == event.providerId;
  }
  return true;
};

let matchesChatTarget = (event: SystemEvent, listener: EventDestinationListener) => {
  if (listener.chatConnectionId != null)
    return listener.chatConnectionId == event.chatConnectionId;
  if (listener.providerId != null) {
    return event.providerId != null && listener.providerId == event.providerId;
  }
  return true;
};

export let matchesListener = (
  event: SystemEvent,
  listener: EventDestinationListener & { eventDestination: EventDestination }
) => {
  if (listener.eventDestination.status != 'active') return false;

  if (event.source == 'callback') {
    if (listener.type != 'callback') return false;
    if (!matchesCallbackTarget(event, listener)) return false;

    // No trigger filter means every trigger on the matched callback(s).
    if (listener.triggers.length == 0) return true;

    return (
      event.callbackTriggerKey != null && listener.triggers.includes(event.callbackTriggerKey)
    );
  }

  if (event.source == 'chat') {
    if (listener.type != 'chat') return false;
    if (!matchesChatTarget(event, listener)) return false;
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
        instanceOid: event.instanceOid ?? undefined,
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined,
        eventDestination: {
          organizationOid: event.organizationOid,
          status: 'active'
        }
      },
      take: dispatchBatchSize,
      orderBy: { oid: 'asc' },
      include: { eventDestination: true }
    });

    let matching = listeners.filter(listener => matchesListener(event, listener));
    if (matching.length > 0) {
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
        where: {
          systemEventOid: event.oid,
          eventDestinationOid: { in: [...byDestination.keys()] },
          status: 'pending',
          attemptCount: 0
        },
        select: { id: true }
      });

      if (intents.length > 0) {
        await attemptDeliveryQueue.addManyWithOps(
          intents.map(intent => ({
            data: { intentId: intent.id, attemptNumber: 1 },
            opts: { id: `event-delivery-attempt:${intent.id}:1` }
          }))
        );
      }
    }

    if (listeners.length == dispatchBatchSize) {
      let cursor = listeners[listeners.length - 1]!.oid.toString();
      await eventDeliveryDispatchQueue.add(
        { systemEventId: event.id, cursor },
        { id: `event-delivery-dispatch:${event.id}:${cursor}` }
      );
    }
  }
);
