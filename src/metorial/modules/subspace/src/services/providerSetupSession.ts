import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
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

      let eventBase = toEventBase(arg0);
      await Fabric.fire('provider.setup_session.created:before', eventBase);

      let setupSession = await inner.create(arg0);

      await Fabric.fire('provider.setup_session.created:after', {
        ...eventBase,
        setupSession
      });

      return setupSession;
    },
    update: async (...args: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(args[0]);
      await Fabric.fire('provider.setup_session.updated:before', eventBase);

      let setupSession = await inner.update(...args);

      await Fabric.fire('provider.setup_session.updated:after', {
        ...eventBase,
        setupSession
      });

      return setupSession;
    }
  })
);

export type SubspaceProviderSetupSession = Awaited<
  ReturnType<typeof subspace.providerSetupSession.get>
>;
