import { subspaceReferenceAuthExportService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthExportService = createSubspaceService(
  subspace.providerAuthExport,
  ['get', 'list', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
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

      return authExport;
    }
  })
);
