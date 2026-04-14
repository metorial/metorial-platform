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

  let destinations = await db.eventDestination.findMany({
    where: {
      tenantOid: event.tenantOid,
      senderOid: event.senderOid,

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
    await eventSucceededQueue.add({ eventId: event.id });
    return;
  }

  await createDeliveryQueue.addMany(
    destinations.map(dest => ({
      eventId: event.id,
      destinationId: dest.id
    }))
  );
});
