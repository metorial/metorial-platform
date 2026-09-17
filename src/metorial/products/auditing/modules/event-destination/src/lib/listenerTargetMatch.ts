import { callbackInternalService } from '@metorial-subspace/module-callback';
import { chatConnectionProviderService } from '@metorial-subspace/module-chat';

export let buildListenerTargetOrBlocks = async (d: {
  callbackIds?: string[];
  chatConnectionIds?: string[];
}): Promise<{ OR: object[] }[]> => {
  let [callbackProviderIdsById, chatProviderIdsByConnection] = await Promise.all([
    d.callbackIds?.length
      ? callbackInternalService.getProviderIdsForCallbackIdsInternal(d.callbackIds)
      : null,
    d.chatConnectionIds?.length
      ? chatConnectionProviderService.getProviderIdsForChatConnectionIdsInternal(
          d.chatConnectionIds
        )
      : null
  ]);

  let callbackProviderIds = callbackProviderIdsById
    ? [...new Set(callbackProviderIdsById.values())]
    : [];
  let chatProviderIds = chatProviderIdsByConnection
    ? [...new Set([...chatProviderIdsByConnection.values()].flat())]
    : [];

  let blocks: { OR: object[] }[] = [];

  if (d.callbackIds?.length) {
    blocks.push({
      OR: [
        { type: 'callback' as const, callbackId: { in: d.callbackIds } },
        ...(callbackProviderIds.length
          ? [
              {
                type: 'callback' as const,
                callbackId: null,
                providerId: { in: callbackProviderIds }
              }
            ]
          : []),
        { type: 'callback' as const, callbackId: null, providerId: null }
      ]
    });
  }

  if (d.chatConnectionIds?.length) {
    blocks.push({
      OR: [
        { type: 'chat' as const, chatConnectionId: { in: d.chatConnectionIds } },
        ...(chatProviderIds.length
          ? [
              {
                type: 'chat' as const,
                chatConnectionId: null,
                providerId: { in: chatProviderIds }
              }
            ]
          : []),
        { type: 'chat' as const, chatConnectionId: null, providerId: null }
      ]
    });
  }

  return blocks;
};
