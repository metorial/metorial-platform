import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { createDeliveryQueue } from './delivery';
import { eventSucceededQueue } from './lifecycle';

export let newEventQueue = createQueue<{
  eventId: string;
}>({
  name: 'sgnl/event/new',
  redisUrl: env.service.REDIS_URL
});

export let newEventQueueProcessor = newEventQueue.process(async data => {
  let event = await db.event.findFirst({
    where: { id: data.eventId }
  });
  if (!event) throw new QueueRetryError();
  if (event.initializationStatus === 'initialized') return;

  let destinations = await db.eventDestination.findMany({
    where: {
      tenantOid: event.tenantOid,
      senderOid: event.senderOid,
      status: 'active',
      isCallbackDestination: event.callbackOid != null,
      callbackDestinationLinks: event.callbackOid
        ? {
            some: {
              callbackOid: event.callbackOid,
              status: 'active'
            }
          }
        : undefined,

      OR: [{ hasEventTypesFilter: false }, { eventTypes: { has: event.eventType } }],

      id: event.hasOnlyForDestinationsFilter ? { in: event.onlyForDestinations } : undefined
    }
  });

  await db.event.updateMany({
    where: { id: data.eventId },
    data: {
      deliveryDestinationCount: destinations.length,
      deliveryFailureCount: 0,
      deliverySuccessCount: 0
    }
  });

  if (!destinations.length) {
    await eventSucceededQueue.add({ eventId: event.id }, { id: event.id });
    await db.event.updateMany({
      where: { id: event.id, initializationStatus: { not: 'initialized' } },
      data: { initializationStatus: 'initialized' }
    });
    return;
  }

  await createDeliveryQueue.addManyWithOps(
    destinations.map(destination => ({
      data: { eventId: event.id, destinationId: destination.id },
      opts: { id: `${event.id}:${destination.id}` }
    }))
  );

  await db.event.updateMany({
    where: { id: event.id, initializationStatus: { not: 'initialized' } },
    data: { initializationStatus: 'initialized' }
  });
});
