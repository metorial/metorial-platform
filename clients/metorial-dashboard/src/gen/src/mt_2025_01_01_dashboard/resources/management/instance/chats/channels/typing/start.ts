import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatsChannelsTypingStartOutput = {
  object: 'chat.typing_indicator';
  started: boolean;
};

export let mapManagementInstanceChatsChannelsTypingStartOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceChatsChannelsTypingStartOutput>(
    0
  );

export type ManagementInstanceChatsChannelsTypingStartBody = {
  threadId?: string | undefined;
  status?: string | undefined;
};

export let mapManagementInstanceChatsChannelsTypingStartBody =
  /* @__PURE__ */ mapObject<ManagementInstanceChatsChannelsTypingStartBody>([
    'thread_id'
  ]);
