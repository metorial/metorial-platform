import { type Instance, db } from '@metorial/db';
import { subspaceIdentityService } from '@metorial/module-subspace';

export let resolveActorIdsForLogFilters = async (d: {
  instance: Instance;
  actorIds?: string[];
  consumerIds?: string[];
  identityIds?: string[];
}) => {
  let actorIds = new Set(d.actorIds ?? []);

  if (d.consumerIds?.length) {
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
    let paginator = await subspaceIdentityService.list({
      instance: d.instance,
      allowDeleted: true,
      ids: d.identityIds
    });
    let identities = await paginator.run({
      limit: Math.max(d.identityIds.length, 100),
      order: 'desc'
    });

    for (let identity of identities.items) {
      actorIds.add(identity.owner.actor.id);
    }
  }

  return actorIds.size ? [...actorIds] : undefined;
};
