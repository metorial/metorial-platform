import { db } from '@metorial/db';
import { deleteAttemptDetails } from './payload';

export let purgeEventDeliveriesForSystemEvent = async (d: { systemEventOid: bigint }) => {
  let attempts = await db.eventDeliveryAttempt.findMany({
    where: { intent: { systemEventOid: d.systemEventOid } },
    select: { id: true, detailsStorageKey: true }
  });

  for (let attempt of attempts) {
    try {
      await deleteAttemptDetails(attempt);
    } catch (error) {
      console.error(
        `[EventDelivery] Failed to delete attempt details for ${attempt.id}`,
        error
      );
    }
  }

  await db.eventDeliveryIntent.deleteMany({ where: { systemEventOid: d.systemEventOid } });
};
