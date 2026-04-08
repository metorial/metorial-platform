import { Fabric } from '@metorial/fabric';
import { resolveConsumerActorIds } from '../lib/resolveConsumerActors';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthConfigService = createSubspaceService(
  subspace.providerAuthConfig,
  ['get', 'list', 'update', 'create', 'delete', 'getConfigSchema'],
  inner => ({
    list: async (
      arg0: Parameters<typeof inner.list>[0] & {
        consumerIds?: string[];
      }
    ) => {
      if (arg0.consumerIds) {
        let consumerActorIds = await resolveConsumerActorIds(arg0.consumerIds);

        arg0.actorIds = [...new Set([...(arg0.actorIds ?? []), ...consumerActorIds])];
      }

      return await inner.list(arg0);
    },
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
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_config.deleted:before', eventBase);

      let authConfig = await inner.delete(...params);

      await Fabric.fire('provider.auth_config.deleted:after', { ...eventBase, authConfig });

      return authConfig;
    }
  })
);

export type SubspaceProviderAuthConfig = Awaited<
  ReturnType<typeof subspace.providerAuthConfig.get>
>;

export type SubspaceProviderAuthConfigSchema = Awaited<
  ReturnType<typeof subspace.providerAuthConfig.getConfigSchema>
>;
