import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatsThreadsGetOutput = {
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
};

export let mapManagementInstanceChatsThreadsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceChatsThreadsGetOutput>(
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
    ],
    1
  );

export type ManagementInstanceChatsThreadsGetQuery = { channelId: string };

export let mapManagementInstanceChatsThreadsGetQuery =
  /* @__PURE__ */ mapObject<ManagementInstanceChatsThreadsGetQuery>([
    'channel_id'
  ]);
