import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceChatsChannelsTypingStartOutput = {
  object: 'chat.typing_indicator';
  started: boolean;
};

export let mapDashboardInstanceChatsChannelsTypingStartOutput =
  mtMap.object<DashboardInstanceChatsChannelsTypingStartOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    started: mtMap.objectField('started', mtMap.passthrough())
  });

export type DashboardInstanceChatsChannelsTypingStartBody = {
  threadId?: string | undefined;
  status?: string | undefined;
};

export let mapDashboardInstanceChatsChannelsTypingStartBody =
  mtMap.object<DashboardInstanceChatsChannelsTypingStartBody>({
    threadId: mtMap.objectField('thread_id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough())
  });

