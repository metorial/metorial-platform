import { Fabric } from '@metorial/fabric';
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

      await Fabric.fire('provider.auth_import.created:after', { ...eventBase, authImport });

      return authImport;
    }
  })
);

export type SubspaceProviderAuthImport = Awaited<
  ReturnType<typeof subspace.providerAuthImport.get>
>;
