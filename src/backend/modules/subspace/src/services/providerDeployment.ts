import { Fabric } from '@metorial/fabric';
import { resolveConsumerActorIds } from '../lib/resolveConsumerActors';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderDeploymentService = createSubspaceService(
  subspace.providerDeployment,
  ['get', 'list', 'update', 'create'],
  inner => ({
    list: async (
      arg0: Parameters<typeof inner.list>[0] & {
        actorIds?: string[];
        consumerIds?: string[];
      }
    ) => {
      if (arg0.consumerIds) {
        let consumerActorIds = await resolveConsumerActorIds(arg0.consumerIds);

        arg0.actorIds = [...new Set([...(arg0.actorIds ?? []), ...consumerActorIds])];
      }

      return await inner.list(arg0);
    },
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.deployment.created:before', eventBase);

      let deployment = await inner.create(...params);

      await Fabric.fire('provider.deployment.created:after', { ...eventBase, deployment });

      return deployment;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.deployment.updated:before', eventBase);

      let deployment = await inner.update(...params);

      await Fabric.fire('provider.deployment.updated:after', { ...eventBase, deployment });

      return deployment;
    }
  })
);

export type SubspaceProviderDeployment = Awaited<
  ReturnType<typeof subspace.providerDeployment.get>
>;
