import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationService = createSubspaceService(
  subspace.integration,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.integration.created:before', eventBase);

      let integration = await inner.create(...params);

      await Fabric.fire('provider.integration.created:after', {
        ...eventBase,
        integration
      });

      return integration;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.integration.deleted:before', eventBase);

      let integration = await inner.delete(...params);

      await Fabric.fire('provider.integration.deleted:after', {
        ...eventBase,
        integration
      });

      return integration;
    }
  })
);

export type SubspaceIntegration = Awaited<ReturnType<typeof subspace.integration.get>>;
