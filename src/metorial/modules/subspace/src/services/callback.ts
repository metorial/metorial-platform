import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackService = createSubspaceService(
  subspace.callback,
  ['get', 'list', 'create', 'update', 'archive'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback.created:before', eventBase);

      let callback = await inner.create(...params);

      await Fabric.fire('provider.callback.created:after', {
        ...eventBase,
        callback
      });

      return callback;
    },
    archive: async (...params: Parameters<typeof inner.archive>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback.archived:before', eventBase);

      let callback = await inner.archive(...params);

      await Fabric.fire('provider.callback.archived:after', {
        ...eventBase,
        callback
      });

      return callback;
    }
  })
);

export type SubspaceCallback = Awaited<ReturnType<typeof subspace.callback.get>>;
