import { Fabric } from '@metorial/fabric';
import { subspaceReferenceAuthImportService } from '@metorial/module-subspace-reference';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthImportService = createSubspaceService(
  subspace.providerAuthImport,
  ['get', 'list', 'create', 'getSchema'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.auth_import.created:before', eventBase);

      let authImport = await inner.create(...params);

      await subspaceReferenceAuthImportService
        .create({
          instance: params[0].instance,
          authImport: {
            id: authImport.id,
            providerId: authImport.providerId,
            providerDeploymentId: authImport.providerDeploymentId ?? null,
            providerAuthConfigId: authImport.authConfig?.id ?? null,
            createdAt: authImport.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      await Fabric.fire('provider.auth_import.created:after', { ...eventBase, authImport });

      return authImport;
    }
  })
);

export type SubspaceProviderAuthImport = Awaited<
  ReturnType<typeof subspace.providerAuthImport.get>
>;
