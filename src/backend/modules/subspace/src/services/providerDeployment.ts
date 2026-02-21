import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderDeploymentService = createSubspaceService(
  subspace.providerDeployment,
  ['get', 'list', 'update', 'create'],
  inner => ({
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
