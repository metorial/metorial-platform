import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { getSentry } from '@metorial/sentry';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'list', 'update', 'create', 'getConfigSchema'],
  inner => ({
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
    }
  })
);

export type SubspaceProviderConfig = Awaited<ReturnType<typeof subspace.providerConfig.get>>;

export type SubspaceProviderConfigSchema = Awaited<
  ReturnType<typeof subspace.providerConfig.getConfigSchema>
>;
