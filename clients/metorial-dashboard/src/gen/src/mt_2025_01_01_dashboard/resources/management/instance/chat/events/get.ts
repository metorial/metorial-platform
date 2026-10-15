import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatEventsGetOutput = {
  object: 'chat.event';
  id: string;
  type: string;
  source: 'webhook' | 'polling' | 'internal';
  chatConnectionId: string;
  chatId: string | null;
  channelId: string | null;
  threadId: string | null;
  messageId: string | null;
  authorId: string | null;
  providerEventId: string | null;
  providerChannelId: string | null;
  providerThreadId: string | null;
  providerMessageId: string | null;
  providerAuthorId: string | null;
  payload: Record<string, any> | null;
  occurredAt: Date;
  createdAt: Date;
  error: {
    code: string | null;
    message: string | null;
    providerCode: string | null;
    operation: string | null;
    retryable: boolean | null;
    retryAfterMs: number | null;
    target: Record<string, any> | null;
  } | null;
};

export let mapManagementInstanceChatEventsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceChatEventsGetOutput>(
    [
      'chat_connection_id',
      'chat_id',
      'channel_id',
      'thread_id',
      'message_id',
      'author_id',
      'provider_event_id',
      'provider_channel_id',
      'provider_thread_id',
      'provider_message_id',
      'provider_author_id',
      'occurred_at',
      'created_at',
      ['error', 0, [1, ['provider_code', 'retry_after_ms']]]
    ],
    1
  );
