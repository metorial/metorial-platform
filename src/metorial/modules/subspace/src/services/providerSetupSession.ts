import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderSetupSessionService = createSubspaceService(
  subspace.providerSetupSession,
  ['get', 'list', 'create', 'update'],
  inner => ({
    create: async (
      arg0: Parameters<typeof inner.create>[0] & {
        consumerId?: string;
      }
    ) => {
      if (arg0.consumerId) {
        let consumer = await db.instanceConsumer.findUnique({
          where: {
            id: arg0.consumerId,
            instanceOid: arg0.instance.oid
          }
        });
        if (!consumer) throw new ServiceError(notFoundError('consumer'));

        let actor = await db.consumerActor.findFirst({
          where: {
            instanceOid: arg0.instance.oid,
            instanceConsumerOid: consumer.oid,
            isDefault: true
          }
        });
        if (!actor || !actor.defaultIdentityId) {
          throw new ServiceError(
            badRequestError({
              message: 'Consumer cannot be used for provider setup session.'
            })
          );
        }

        arg0.identityId = actor.defaultIdentityId;
        arg0.privateMetadata = {
          $owner: 'consumer',
          ...arg0.privateMetadata,
          consumerId: arg0.consumerId
        };
      }

      return await inner.create(arg0);
    }
  })
);

export type SubspaceProviderSetupSession = Awaited<
  ReturnType<typeof subspace.providerSetupSession.get>
>;
