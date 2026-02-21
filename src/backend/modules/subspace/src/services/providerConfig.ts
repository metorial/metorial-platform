import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'list', 'update', 'create', 'getConfigSchema'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config.created:before', eventBase);

      let config = await inner.create(...params);

      await Fabric.fire('provider.config.created:after', { ...eventBase, config });

      return config;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config.updated:before', eventBase);

      let config = await inner.update(...params);

      await Fabric.fire('provider.config.updated:after', { ...eventBase, config });

      return config;
    }
  })
);

export type SubspaceProviderConfig = Awaited<ReturnType<typeof subspace.providerConfig.get>>;
