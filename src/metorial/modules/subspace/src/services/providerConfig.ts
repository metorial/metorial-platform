import { getSentry } from '@lowerdeck/sentry';
import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { resolveConsumerActorIds } from '../lib/resolveConsumerActors';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'getMany', 'list', 'update', 'create', 'delete', 'getConfigSchema'],
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
      await Fabric.fire('provider.config.created:before', eventBase);

      let config = await inner.create(...params);

      await Fabric.fire('provider.config.created:after', { ...eventBase, config });

      if (config.fromVault) {
        usageService
          .ingestUsageRecord({
            owner: {
              id: eventBase.instance.id,
              type: 'instance'
            },
            entity: {
              id: config.fromVault.id,
              type: 'provider_config_vault'
            },
            type: 'provider_config_vault.used'
          })
          .catch(e => Sentry.captureException(e));
      }

      return config;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config.updated:before', eventBase);

      let config = await inner.update(...params);

      await Fabric.fire('provider.config.updated:after', { ...eventBase, config });

      return config;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.config.deleted:before', eventBase);

      let config = await inner.delete(...params);

      await Fabric.fire('provider.config.deleted:after', { ...eventBase, config });

      return config;
    }
  })
);

export type SubspaceProviderConfig = Awaited<ReturnType<typeof subspace.providerConfig.get>>;

export type SubspaceProviderConfigSchema = Awaited<
  ReturnType<typeof subspace.providerConfig.getConfigSchema>
>;
