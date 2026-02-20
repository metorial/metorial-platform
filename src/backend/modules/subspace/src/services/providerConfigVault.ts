import { Fabric } from '@metorial/fabric';
import { subspaceReferenceConfigVaultService } from '@metorial/module-subspace-reference';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigVaultService = createSubspaceService(
  subspace.providerConfigVault,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config_vault.created:before', eventBase);

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

      await Fabric.fire('provider.config_vault.created:after', { ...eventBase, configVault });

      return configVault;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config_vault.updated:before', eventBase);

      let configVault = await inner.update(...params);

      await Fabric.fire('provider.config_vault.updated:after', { ...eventBase, configVault });

      return configVault;
    }
  })
);

export type SubspaceProviderConfigVault = Awaited<
  ReturnType<typeof subspace.providerConfigVault.get>
>;
