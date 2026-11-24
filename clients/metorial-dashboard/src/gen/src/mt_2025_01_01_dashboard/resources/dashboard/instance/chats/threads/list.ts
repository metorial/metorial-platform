import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceChatsThreadsListOutput = {
  items: {
    object: 'chat.thread';
    id: string;
    chatId: string;
    channelId: string;
    type: 'conversation' | 'dm' | 'post';
    providerType: string;
    providerThreadId: string;
    providerRootMessageId: string | null;
    subject: string | null;
    permalink: string | null;
    context: {
      type:
        | 'issue'
        | 'pull_request'
        | 'review'
        | 'page'
        | 'ticket'
        | 'post'
        | 'unknown';
      id: string;
      description?: string | undefined;
      status?: string | undefined;
      url?: string | undefined;
      author?: { id: string; name: string } | undefined;
      assignee?: { id: string; name: string } | undefined;
      labels?: string[] | undefined;
    } | null;
    replyCount: number | null;
    lastReplyAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lastInteractionAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceChatsThreadsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceChatsThreadsListOutput>(
    [
      7,
      [
        1,
        [
          'chat_id',
          'channel_id',
          'provider_type',
          'provider_thread_id',
          'provider_root_message_id',
          'reply_count',
          'last_reply_at',
          'created_at',
          'updated_at',
          'last_interaction_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceChatsThreadsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { channelId: string; type?: 'conversation' | 'dm' | 'post' | undefined };

export let mapDashboardInstanceChatsThreadsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceChatsThreadsListQuery>([
    3,
    [[0, [1, ['channel_id']]]]
  ]);
