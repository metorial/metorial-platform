import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceCallbackInstanceService = createSubspaceService(
  subspace.callbackInstance,
  ['get', 'list', 'attach', 'detach'],
  inner => ({
    attach: async (...params: Parameters<typeof inner.attach>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback_instance.attached:before', eventBase);

      let callbackInstance = await inner.attach(...params);

      await Fabric.fire('provider.callback_instance.attached:after', {
        ...eventBase,
        callbackInstance
      });

      return callbackInstance;
    },
    detach: async (...params: Parameters<typeof inner.detach>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.callback_instance.detached:before', eventBase);

      let callbackInstance = await inner.detach(...params);

      await Fabric.fire('provider.callback_instance.detached:after', {
        ...eventBase,
        callbackInstance
      });

      return callbackInstance;
    }
  })
);

export type SubspaceCallbackInstance = Awaited<
  ReturnType<typeof subspace.callbackInstance.get>
>;
