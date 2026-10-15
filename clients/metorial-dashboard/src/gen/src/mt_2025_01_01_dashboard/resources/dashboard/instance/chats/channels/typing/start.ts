import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceChatsChannelsTypingStartOutput = {
  object: 'chat.typing_indicator';
  started: boolean;
};

export let mapDashboardInstanceChatsChannelsTypingStartOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceChatsChannelsTypingStartOutput>(
    0
  );

export type DashboardInstanceChatsChannelsTypingStartBody = {
  threadId?: string | undefined;
  status?: string | undefined;
};

export let mapDashboardInstanceChatsChannelsTypingStartBody =
  /* @__PURE__ */ mapObject<DashboardInstanceChatsChannelsTypingStartBody>([
    'thread_id'
  ]);
