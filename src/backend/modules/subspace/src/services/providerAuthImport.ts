import { subspaceReferenceAuthImportService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthImportService = createSubspaceService(
  subspace.providerAuthImport,
  ['get', 'list', 'create', 'getSchema'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let authImport = await inner.create(...params);

      await subspaceReferenceAuthImportService
        .create({
          instance: params[0].instance,
          authImport: {
            id: authImport.id,
            providerId: params[0].providerId,
            providerDeploymentId: authImport.providerDeploymentId,
            providerAuthConfigId: authImport.providerAuthConfigId,
            createdAt: authImport.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return authImport;
    }
  })
);

export type SubspaceProviderAuthImport = Awaited<
  ReturnType<typeof subspace.providerAuthImport.get>
>;
