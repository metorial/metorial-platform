import { mtMap } from '@metorial/util-resource-mapper';

export type ChatEventsGetOutput = {
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

export let mapChatEventsGetOutput = mtMap.object<ChatEventsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  source: mtMap.objectField('source', mtMap.passthrough()),
  chatConnectionId: mtMap.objectField(
    'chat_connection_id',
    mtMap.passthrough()
  ),
  chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
  channelId: mtMap.objectField('channel_id', mtMap.passthrough()),
  threadId: mtMap.objectField('thread_id', mtMap.passthrough()),
  messageId: mtMap.objectField('message_id', mtMap.passthrough()),
  authorId: mtMap.objectField('author_id', mtMap.passthrough()),
  providerEventId: mtMap.objectField('provider_event_id', mtMap.passthrough()),
  providerChannelId: mtMap.objectField(
    'provider_channel_id',
    mtMap.passthrough()
  ),
  providerThreadId: mtMap.objectField(
    'provider_thread_id',
    mtMap.passthrough()
  ),
  providerMessageId: mtMap.objectField(
    'provider_message_id',
    mtMap.passthrough()
  ),
  providerAuthorId: mtMap.objectField(
    'provider_author_id',
    mtMap.passthrough()
  ),
  payload: mtMap.objectField('payload', mtMap.passthrough()),
  occurredAt: mtMap.objectField('occurred_at', mtMap.date()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  error: mtMap.objectField(
    'error',
    mtMap.object({
      code: mtMap.objectField('code', mtMap.passthrough()),
      message: mtMap.objectField('message', mtMap.passthrough()),
      providerCode: mtMap.objectField('provider_code', mtMap.passthrough()),
      operation: mtMap.objectField('operation', mtMap.passthrough()),
      retryable: mtMap.objectField('retryable', mtMap.passthrough()),
      retryAfterMs: mtMap.objectField('retry_after_ms', mtMap.passthrough()),
      target: mtMap.objectField('target', mtMap.passthrough())
    })
  )
});

