import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ChatEventsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapChatEventsListOutput =
  /* @__PURE__ */ createMapper<ChatEventsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type ChatEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  chatId?: string | string[] | undefined;
  chatConnectionId?: string | string[] | undefined;
  chatInstanceId?: string | string[] | undefined;
  type?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  occurredAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapChatEventsListQuery =
  /* @__PURE__ */ createMapper<ChatEventsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'chat_id',
            'chat_connection_id',
            'chat_instance_id',
            ['created_at', 1, 5],
            ['occurred_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
