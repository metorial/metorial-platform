import { badRequestError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceIdentityService = createSubspaceService(
  subspace.identity,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    delete: async (
      arg0: Parameters<typeof inner.delete>[0] & { canEditConsumerActor?: boolean }
    ) => {
      if (!arg0.canEditConsumerActor) {
        let consumerActor = await db.consumerActor.findFirst({
          where: {
            defaultIdentityId: arg0.identityId,
            instanceOid: arg0.instance.oid
          }
        });
        if (consumerActor) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot delete identity linked to consumer'
            })
          );
        }
      }

      return await inner.delete(arg0);
    }
  })
);

export type SubspaceIdentity = Awaited<ReturnType<typeof subspace.identity.get>>;
