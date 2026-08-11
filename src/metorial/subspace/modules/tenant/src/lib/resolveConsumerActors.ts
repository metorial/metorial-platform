import { metorialDb } from './metorialDb';

export let resolveConsumerActorIds = async (consumerIds?: string[]) => {
  if (!consumerIds) return [];

  return await metorialDb.consumerActor
    .findMany({
      where: {
        instanceConsumer: { id: { in: consumerIds } }
      },
      select: { id: true }
    })
    .then(res => res.map(r => r.id));
};
