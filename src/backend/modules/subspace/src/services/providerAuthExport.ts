import { Fabric } from '@metorial/fabric';
import { subspaceReferenceAuthExportService } from '@metorial/module-subspace-reference';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthExportService = createSubspaceService(
  subspace.providerAuthExport,
  ['get', 'list', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_export.created:before', eventBase);

      let authExport = await inner.create(...params);

      await subspaceReferenceAuthExportService
        .create({
          instance: params[0].instance,
          authExport: {
            id: authExport.id,
            providerAuthConfigId: params[0].providerAuthConfigId,
            createdAt: authExport.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      await Fabric.fire('provider.auth_export.created:after', { ...eventBase, authExport });

      return authExport;
    }
  })
);

export type SubspaceProviderAuthExport = Awaited<
  ReturnType<typeof subspace.providerAuthExport.get>
>;
