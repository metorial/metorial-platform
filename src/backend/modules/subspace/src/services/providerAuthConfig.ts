import { subspaceReferenceAuthConfigService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthConfigService = createSubspaceService(
  subspace.providerAuthConfig,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let authConfig = await inner.create(...params);

      await subspaceReferenceAuthConfigService
        .create({
          instance: params[0].instance,
          authConfig: {
            id: authConfig.id,
            providerId: params[0].providerId,
            providerDeploymentId: authConfig.providerDeploymentId,
            providerAuthMethodId: params[0].providerAuthMethodId,
            name: authConfig.name,
            isEphemeral: authConfig.isEphemeral,
            createdAt: authConfig.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return authConfig;
    }
  })
);
