import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceToolCallService = createSubspaceService(
  subspace.toolCall,
  ['get', 'list', 'create'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.tool_call.created:before', eventBase);

      let toolCall = await inner.create(...params);

      await Fabric.fire('provider.tool_call.created:after', { ...eventBase, toolCall });

      return toolCall;
    }
  })
);

export type SubspaceToolCall = Awaited<ReturnType<typeof subspace.toolCall.get>>;
