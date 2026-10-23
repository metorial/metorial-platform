import { type Instance, db } from '@metorial/db';
import { searchConsumerIds } from '@metorial/module-search';
import { identityService } from '@metorial-subspace/module-identity';

let MIN_SEARCH_QUERY_LENGTH = 2;

let resolveConsumerActorIds = async (d: { instance: Instance; consumerIds: string[] }) => {
  let consumerActors = await db.consumerActor.findMany({
    where: {
      instanceOid: d.instance.oid,
      instanceConsumer: {
        id: {
          in: d.consumerIds
        }
      }
    },
    select: {
      id: true
    }
  });

  return consumerActors.map(actor => actor.id);
};

export let resolveActorIdsForLogFilters = async (d: {
  instance: Instance;
  actorIds?: string[];
  consumerIds?: string[];
  identityIds?: string[];
}) => {
  let hasActorFilter = !!d.actorIds?.length;

  let actorIds = new Set(d.actorIds ?? []);

  if (d.consumerIds?.length) {
    hasActorFilter = true;

    let consumerActorIds = await resolveConsumerActorIds({
      instance: d.instance,
      consumerIds: d.consumerIds
    });

    for (let actorId of consumerActorIds) {
      actorIds.add(actorId);
    }
  }

  if (d.identityIds?.length) {
    hasActorFilter = true;

    let paginator = await identityService.listIdentities({
      instance: d.instance,
      allowDeleted: true,
      ids: d.identityIds
    });
    let identities = await paginator.run({
      limit: Math.max(d.identityIds.length, 100),
      order: 'desc'
    });

    for (let identity of identities.items) {
      actorIds.add(identity.actor.id);
    }
  }

  return hasActorFilter ? [...actorIds] : undefined;
};

export let resolveSearchActorIds = async (d: { instance: Instance; search?: string }) => {
  let query = d.search?.trim();
  if (!query || query.length < MIN_SEARCH_QUERY_LENGTH) return undefined;

  let consumerIds = await searchConsumerIds({ instanceId: d.instance.id, query });
  if (!consumerIds.length) return undefined;

  return await resolveConsumerActorIds({ instance: d.instance, consumerIds });
};
