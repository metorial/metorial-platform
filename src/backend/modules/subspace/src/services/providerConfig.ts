import { subspaceReferenceConfigService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'list', 'update', 'create', 'delete', 'getConfigSchema'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let config = await inner.create(...params);

      await subspaceReferenceConfigService
        .create({
          instance: params[0].instance,
          config: {
            id: config.id,
            providerId: params[0].providerId,
            providerDeploymentId: config.providerDeploymentId,
            name: config.name,
            isEphemeral: config.isEphemeral,
            createdAt: config.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return config;
    },

    delete: async (...params: Parameters<typeof inner.delete>) => {
      let result = await inner.delete(...params);

      await subspaceReferenceConfigService
        .delete({
          instance: params[0].instance,
          id: params[0].providerConfigId
        })
        .catch(err => console.error('Failed to remove subspace reference:', err));

      return result;
    }
  })
);
