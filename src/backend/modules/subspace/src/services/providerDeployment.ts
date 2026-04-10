import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { resolveConsumerActorIds } from '../lib/resolveConsumerActors';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderDeploymentService = createSubspaceService(
  subspace.providerDeployment,
  ['get', 'list', 'update', 'create', 'delete'],
  inner => ({
    list: async (
      arg0: Parameters<typeof inner.list>[0] & {
        consumerIds?: string[];
      }
    ) => {
      if (arg0.consumerIds) {
        let consumerActorIds = await resolveConsumerActorIds(arg0.consumerIds);

        arg0.actorIds = [...new Set([...(arg0.actorIds ?? []), ...consumerActorIds])];
      }

      return await inner.list(arg0);
    },
    create: async (arg0: Parameters<typeof inner.create>[0]) => {
      let eventBase = toEventBase(arg0);
      await Fabric.fire('provider.deployment.created:before', eventBase);

      let deployment = await inner.create(arg0);

      await Fabric.fire('provider.deployment.created:after', { ...eventBase, deployment });

      return deployment;
    },
    update: async (arg0: Parameters<typeof inner.update>[0]) => {
      let eventBase = toEventBase(arg0);
      await Fabric.fire('provider.deployment.updated:before', eventBase);

      let deployment = await inner.update(arg0);

      await Fabric.fire('provider.deployment.updated:after', { ...eventBase, deployment });

      return deployment;
    },
    delete: async (arg0: Parameters<typeof inner.delete>[0]) => {
      let eventBase = toEventBase(arg0);
      await Fabric.fire('provider.deployment.deleted:before', eventBase);

      let providerTemplate = await db.providerTemplate.findFirst({
        where: {
          providerDeploymentId: arg0.providerDeploymentId,
          status: 'active'
        }
      });
      if (providerTemplate) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete deployment with active templates'
          })
        );
      }

      let deployment = await inner.delete(arg0);

      await Fabric.fire('provider.deployment.deleted:after', { ...eventBase, deployment });

      return deployment;
    }
  })
);

export type SubspaceProviderDeployment = Awaited<
  ReturnType<typeof subspace.providerDeployment.get>
>;
