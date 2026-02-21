import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthConfigService = createSubspaceService(
  subspace.providerAuthConfig,
  ['get', 'list', 'update', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_config.created:before', eventBase);

      let authConfig = await inner.create(...params);

      await Fabric.fire('provider.auth_config.created:after', { ...eventBase, authConfig });

      return authConfig;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_config.updated:before', eventBase);

      let authConfig = await inner.update(...params);

      await Fabric.fire('provider.auth_config.updated:after', { ...eventBase, authConfig });

      return authConfig;
    }
  })
);

export type SubspaceProviderAuthConfig = Awaited<
  ReturnType<typeof subspace.providerAuthConfig.get>
>;
