import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceChatsMessagesReactionsListOutput = {
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

export let mapDashboardInstanceChatsMessagesReactionsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceChatsMessagesReactionsListOutput>(
    0
  );

export type DashboardInstanceChatsMessagesReactionsListQuery = {
  channelId: string;
};

export let mapDashboardInstanceChatsMessagesReactionsListQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceChatsMessagesReactionsListQuery>([
    'channel_id'
  ]);
