import { db } from '@metorial/db';

export let resolveConsumerActorIds = async (consumerIds?: string[]) => {
  if (!consumerIds) return [];

  return await db.consumerActor
    .findMany({
      where: {
        instanceConsumer: { id: { in: consumerIds } }
      },
      select: { id: true }
    })
    .then(res => res.map(r => r.id));
};
