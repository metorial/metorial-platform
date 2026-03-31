import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  Consumer,
  ConsumerProfile,
  ConsumerSurface,
  db,
  InstanceConsumer,
  OrganizationMember
} from '@metorial/db';
import { resolveConsumerActorIds } from '../lib/resolveConsumerActors';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

let enrichIdentityActors = async (actors: SubspaceIdentityActorInner[]) => {
  let consumerActors = await db.consumerActor.findMany({
    where: {
      id: { in: actors.map(a => a.id) }
    },
    include: {
      instanceConsumer: {
        include: {
          consumer: {
            include: {
              organizationMember: true,
              profiles: {
                include: {
                  surface: true
                }
              }
            }
          }
        }
      }
    }
  });

  let consumerActorMap = new Map(consumerActors.map(a => [a.id, a]));

  return actors.map(a => {
    let consumerActor = consumerActorMap.get(a.id);
    if (!consumerActor) return a;

    return {
      ...a,
      consumer: consumerActor.instanceConsumer
    };
  });
};

export let subspaceIdentityActorService = createSubspaceService(
  subspace.identityActor,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    get: async (...args: Parameters<typeof inner.get>) => {
      let res = await inner.get(...args);
      if (!res) return res;
      let [enriched] = await enrichIdentityActors([res]);
      return enriched! satisfies SubspaceIdentityActor;
    },

    list: async (
      arg0: Parameters<typeof inner.list>[0] & {
        consumerIds?: string[];
      }
    ) => {
      if (arg0.consumerIds) {
        let consumerActorIds = await resolveConsumerActorIds(arg0.consumerIds);

        arg0.ids = [...(arg0.ids ?? []), ...consumerActorIds];
      }

      let res = await inner.list(arg0);
      return res.map(items => enrichIdentityActors(items));
    },

    update: async (
      arg0: Parameters<typeof inner.update>[0] & { canEditConsumerActor?: boolean }
    ) => {
      let consumerActor = await db.consumerActor.findUnique({
        where: {
          id: arg0.identityActorId
        }
      });
      if (consumerActor) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot update identity actor linked to consumer'
          })
        );
      }

      return await inner.update(arg0);
    },

    delete: async (
      arg: Parameters<typeof inner.delete>[0] & { canEditConsumerActor?: boolean }
    ) => {
      let consumerActor = await db.consumerActor.findUnique({
        where: {
          id: arg.identityActorId
        }
      });
      if (consumerActor) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete identity actor linked to consumer'
          })
        );
      }

      return await inner.delete(arg);
    }
  })
);

type SubspaceIdentityActorInner = Awaited<ReturnType<typeof subspace.identityActor.get>>;

export type SubspaceIdentityActor = SubspaceIdentityActorInner & {
  consumer?: InstanceConsumer & {
    consumer: Consumer & {
      organizationMember: OrganizationMember | null;
      profiles: (ConsumerProfile & {
        surface: ConsumerSurface;
      })[];
    };
  };
};
