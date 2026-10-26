import { type Instance, db } from '@metorial/db';
import { resourceActorService } from '@metorial/module-resource-actor';
import { identityService } from '@metorial-subspace/module-identity';

export let resolveActorIdsForLogFilters = async (d: {
  instance: Instance;
  actorIds?: string[];
  consumerIds?: string[];
  consumerProfileIds?: string[];
  identityIds?: string[];
}) => {
  let hasActorFilter = !!d.actorIds?.length;

  let actorIds = new Set(d.actorIds ?? []);

  if (d.consumerIds?.length) {
    hasActorFilter = true;

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

    for (let actor of consumerActors) {
      actorIds.add(actor.id);
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

  if (d.consumerProfileIds?.length) {
    let profileActorIds = await resourceActorService.listConsumerActorIds({
      instance: d.instance,
      consumerProfileIds: d.consumerProfileIds
    });

    return hasActorFilter ? profileActorIds.filter(id => actorIds.has(id)) : profileActorIds;
  }

  return hasActorFilter ? [...actorIds] : undefined;
};
