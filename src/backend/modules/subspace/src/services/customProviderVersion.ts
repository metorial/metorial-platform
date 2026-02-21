import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderVersionService = createSubspaceService(
  subspace.customProviderVersion,
  ['get', 'list', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.custom_provider.version.created:before', eventBase);

      let customProviderVersion = await inner.create(...params);

      await Fabric.fire('provider.custom_provider.version.created:after', {
        ...eventBase,
        customProviderVersion
      });

      return customProviderVersion;
    }
  })
);

export type SubspaceCustomProviderVersion = Awaited<
  ReturnType<typeof subspace.customProviderVersion.get>
>;
