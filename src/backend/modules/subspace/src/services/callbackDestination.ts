import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackDestinationService = createSubspaceService(
  subspace.callbackDestination,
  ['get', 'list', 'create', 'update', 'archive'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback_destination.created:before', eventBase);

      let callbackDestination = await inner.create(...params);

      await Fabric.fire('provider.callback_destination.created:after', {
        ...eventBase,
        callbackDestination
      });

      return callbackDestination;
    },
    archive: async (...params: Parameters<typeof inner.archive>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback_destination.archived:before', eventBase);

      let callbackDestination = await inner.archive(...params);

      await Fabric.fire('provider.callback_destination.archived:after', {
        ...eventBase,
        callbackDestination
      });

      return callbackDestination;
    }
  })
);

export type SubspaceCallbackDestination = Awaited<
  ReturnType<typeof subspace.callbackDestination.get>
>;
