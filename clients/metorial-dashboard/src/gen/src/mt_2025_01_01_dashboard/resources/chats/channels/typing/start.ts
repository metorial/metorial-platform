import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ChatsChannelsTypingStartOutput = {
  object: 'chat.typing_indicator';
  started: boolean;
};

export let mapChatsChannelsTypingStartOutput =
  /* @__PURE__ */ createMapper<ChatsChannelsTypingStartOutput>(0);

export type ChatsChannelsTypingStartBody = {
  threadId?: string | undefined;
  status?: string | undefined;
};

export let mapChatsChannelsTypingStartBody =
  /* @__PURE__ */ mapObject<ChatsChannelsTypingStartBody>(['thread_id']);
