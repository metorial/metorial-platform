import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCustomProviderCommitService = createSubspaceService(
  subspace.customProviderCommit,
  ['get', 'list', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.custom_provider.commit.created:before', eventBase);

      let customProviderCommit = await inner.create(...params);

      await Fabric.fire('provider.custom_provider.commit.created:after', {
        ...eventBase,
        customProviderCommit
      });

      return customProviderCommit;
    }
  })
);

export type SubspaceCustomProviderCommit = Awaited<
  ReturnType<typeof subspace.customProviderCommit.get>
>;
