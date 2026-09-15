import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceChatsChannelsTypingStartOutput = {
  object: 'chat.typing_indicator';
  started: boolean;
};

export let mapManagementInstanceChatsChannelsTypingStartOutput =
  mtMap.object<ManagementInstanceChatsChannelsTypingStartOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    started: mtMap.objectField('started', mtMap.passthrough())
  });

export type ManagementInstanceChatsChannelsTypingStartBody = {
  threadId?: string | undefined;
  status?: string | undefined;
};

export let mapManagementInstanceChatsChannelsTypingStartBody =
  mtMap.object<ManagementInstanceChatsChannelsTypingStartBody>({
    threadId: mtMap.objectField('thread_id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough())
  });

