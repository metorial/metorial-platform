import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCustomProviderService = createSubspaceService(
  subspace.customProvider,
  ['get', 'list', 'update', 'create', 'archive'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.custom_provider.created:before', eventBase);

      let customProvider = await inner.create(...params);

      await Fabric.fire('provider.custom_provider.created:after', {
        ...eventBase,
        customProvider
      });

      return customProvider;
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.custom_provider.updated:before', eventBase);

      let customProvider = await inner.update(...params);

      await Fabric.fire('provider.custom_provider.updated:after', {
        ...eventBase,
        customProvider
      });

      return customProvider;
    },
    archive: async (...params: Parameters<typeof inner.archive>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.custom_provider.archived:before', eventBase);

      let customProvider = await inner.archive(...params);

      await Fabric.fire('provider.custom_provider.archived:after', {
        ...eventBase,
        customProvider
      });

      return customProvider;
    }
  })
);

export type SubspaceCustomProvider = Awaited<ReturnType<typeof subspace.customProvider.get>>;
