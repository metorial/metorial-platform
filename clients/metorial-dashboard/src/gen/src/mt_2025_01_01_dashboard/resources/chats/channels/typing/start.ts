import { mtMap } from '@metorial/util-resource-mapper';

export type ChatsChannelsTypingStartOutput = {
  object: 'chat.typing_indicator';
  started: boolean;
};

export let mapChatsChannelsTypingStartOutput =
  mtMap.object<ChatsChannelsTypingStartOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    started: mtMap.objectField('started', mtMap.passthrough())
  });

export type ChatsChannelsTypingStartBody = {
  threadId?: string | undefined;
  status?: string | undefined;
};

export let mapChatsChannelsTypingStartBody =
  mtMap.object<ChatsChannelsTypingStartBody>({
    threadId: mtMap.objectField('thread_id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough())
  });

