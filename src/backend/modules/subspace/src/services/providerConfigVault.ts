import { subspaceReferenceConfigVaultService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigVaultService = createSubspaceService(
  subspace.providerConfigVault,
  ['get', 'list', 'update', 'create', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let configVault = await inner.create(...params);

      await subspaceReferenceConfigVaultService
        .create({
          instance: params[0].instance,
          configVault: {
            id: configVault.id,
            providerId: params[0].providerId,
            providerDeploymentId: configVault.providerDeploymentId,
            name: configVault.name,
            isEphemeral: configVault.isEphemeral,
            createdAt: configVault.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return configVault;
    },

    delete: async (...params: Parameters<typeof inner.delete>) => {
      let result = await inner.delete(...params);

      await subspaceReferenceConfigVaultService
        .delete({
          instance: params[0].instance,
          id: params[0].providerConfigVaultId
        })
        .catch(err => console.error('Failed to remove subspace reference:', err));

      return result;
    }
  })
);
