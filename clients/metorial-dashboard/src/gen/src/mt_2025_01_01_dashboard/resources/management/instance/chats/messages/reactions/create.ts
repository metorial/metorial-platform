import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatsMessagesReactionsCreateOutput = {
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

export let mapManagementInstanceChatsMessagesReactionsCreateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceChatsMessagesReactionsCreateOutput>(
    0
  );

export type ManagementInstanceChatsMessagesReactionsCreateBody = {
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

export let mapManagementInstanceChatsMessagesReactionsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceChatsMessagesReactionsCreateBody>(
    ['channel_id']
  );
