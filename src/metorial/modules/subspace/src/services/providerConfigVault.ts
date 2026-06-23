import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigVaultService = createSubspaceService(
  subspace.providerConfigVault,
  ['get', 'getMany', 'list', 'update', 'create', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config_vault.created:before', eventBase);

      let configVault = await inner.create(...params);

      await Fabric.fire('provider.config_vault.created:after', { ...eventBase, configVault });

      return configVault;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config_vault.updated:before', eventBase);

      let configVault = await inner.update(...params);

      await Fabric.fire('provider.config_vault.updated:after', { ...eventBase, configVault });

      return configVault;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config_vault.deleted:before', eventBase);

      let configVault = await inner.delete(...params);

      await Fabric.fire('provider.config_vault.deleted:after', { ...eventBase, configVault });

      return configVault;
    }
  })
);

export type SubspaceProviderConfigVault = Awaited<
  ReturnType<typeof subspace.providerConfigVault.get>
>;
