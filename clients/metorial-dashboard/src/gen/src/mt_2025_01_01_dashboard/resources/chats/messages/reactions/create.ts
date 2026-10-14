import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ChatsMessagesReactionsCreateOutput = {
  object: 'chat.reaction_list';
  reactions: {
    emoji:
      | { type: 'unicode'; value: string }
      | {
          type: 'custom';
          name: string;
          url?: string | undefined;
          id?: string | undefined;
        };
    count: number;
    authors?:
      | {
          userId: string;
          userName: string;
          fullName: string;
          type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
          role?: 'member' | 'guest' | 'unknown' | undefined;
          providerType?: string | undefined;
          isMe: boolean;
          email?: string | undefined;
          imageUrl?: string | undefined;
          raw?: any | undefined;
        }[]
      | undefined;
  }[];
};

export let mapChatsMessagesReactionsCreateOutput =
  /* @__PURE__ */ createMapper<ChatsMessagesReactionsCreateOutput>(0);

export type ChatsMessagesReactionsCreateBody = {
  channelId: string;
  emoji:
    | string
    | { type: 'unicode'; value: string }
    | {
        type: 'custom';
        name: string;
        url?: string | undefined;
        id?: string | undefined;
      };
};

export let mapChatsMessagesReactionsCreateBody =
  /* @__PURE__ */ mapObject<ChatsMessagesReactionsCreateBody>(['channel_id']);
