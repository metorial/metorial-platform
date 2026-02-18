import { subspaceReferenceConfigVaultService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigVaultService = createSubspaceService(
  subspace.providerConfigVault,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let configVault = await inner.create(...params);

      await subspaceReferenceConfigVaultService
        .create({
          instance: params[0].instance,
          configVault: {
            id: configVault.id,
            providerId: configVault.providerId,
            providerDeploymentId: configVault.deploymentId?.id ?? null,
            name: configVault.name,
            createdAt: configVault.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return configVault;
    }
  })
);

export type SubspaceProviderConfigVault = Awaited<ReturnType<typeof subspace.providerConfigVault.get>>;
