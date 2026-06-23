import { getSentry } from '@lowerdeck/sentry';
import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

export let subspaceProviderAuthExportService = createSubspaceService(
  subspace.providerAuthExport,
  ['get', 'list', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_export.created:before', eventBase);

      let authExport = await inner.create(...params);

      await Fabric.fire('provider.auth_export.created:after', { ...eventBase, authExport });

      usageService
        .ingestUsageRecord({
          owner: {
            id: eventBase.instance.id,
            type: 'instance'
          },
          entity: {
            id: authExport.authConfig.id,
            type: 'provider_auth_config'
          },
          type: 'provider_auth_config.exported'
        })
        .catch(e => Sentry.captureException(e));

      return authExport;
    }
  })
);

export type SubspaceProviderAuthExport = Awaited<
  ReturnType<typeof subspace.providerAuthExport.get>
>;
