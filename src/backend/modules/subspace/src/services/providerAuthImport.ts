import { getSentry } from '@mtsrc/sentry';
import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceProviderAuthImportService = createSubspaceService(
  subspace.providerAuthImport,
  ['get', 'list', 'create', 'getSchema'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_import.created:before', eventBase);

      let authImport = await inner.create(...params);

      await Fabric.fire('provider.auth_import.created:after', { ...eventBase, authImport });

      usageService
        .ingestUsageRecord({
          owner: {
            id: eventBase.instance.id,
            type: 'instance'
          },
          entity: {
            id: authImport.authConfig.id,
            type: 'provider_auth_config'
          },
          type: 'provider_auth_config.imported'
        })
        .catch(e => Sentry.captureException(e));

      return authImport;
    }
  })
);

export type SubspaceProviderAuthImport = Awaited<
  ReturnType<typeof subspace.providerAuthImport.get>
>;

export type SubspaceProviderAuthImportSchema = Awaited<
  ReturnType<typeof subspace.providerAuthImport.getSchema>
>;
