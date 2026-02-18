import { subspaceReferenceDeploymentService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderDeploymentService = createSubspaceService(
  subspace.providerDeployment,
  ['get', 'list', 'update', 'create', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let deployment = await inner.create(...params);

      await subspaceReferenceDeploymentService
        .create({
          instance: params[0].instance,
          deployment: {
            id: deployment.id,
            providerId: params[0].providerId,
            name: deployment.name,
            isEphemeral: deployment.isEphemeral,
            createdAt: deployment.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return deployment;
    },

    delete: async (...params: Parameters<typeof inner.delete>) => {
      let result = await inner.delete(...params);

      await subspaceReferenceDeploymentService
        .delete({
          instance: params[0].instance,
          id: params[0].providerDeploymentId
        })
        .catch(err => console.error('Failed to remove subspace reference:', err));

      return result;
    }
  })
);

export type SubspaceProviderDeployment = Awaited<
  ReturnType<typeof subspace.providerDeployment.get>
>;
