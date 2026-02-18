import { subspaceReferenceConfigService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'list', 'update', 'create', 'getConfigSchema'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let config = await inner.create(...params);

      await subspaceReferenceConfigService
        .create({
          instance: params[0].instance,
          config: {
            id: config.id,
            providerId: config.providerId,
            providerDeploymentId: config.deployment?.id ?? null,
            name: config.name,
            isEphemeral: config.isEphemeral,
            createdAt: config.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return config;
    }
  })
);

export type SubspaceProviderConfig = Awaited<ReturnType<typeof subspace.providerConfig.get>>;
