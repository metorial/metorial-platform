import { Fabric } from '@metorial/fabric';
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

      await Fabric.fire('provider.auth_export.created:after', { ...eventBase, authExport });

      return authExport;
    }
  })
);

export type SubspaceProviderAuthExport = Awaited<
  ReturnType<typeof subspace.providerAuthExport.get>
>;
