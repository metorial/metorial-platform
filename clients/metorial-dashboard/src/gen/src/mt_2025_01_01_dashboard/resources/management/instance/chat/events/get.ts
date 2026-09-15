import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceChatEventsGetOutput = {
  object: 'chat.event';
  id: string;
  type: string;
  source: 'webhook' | 'polling';
  chatId: string;
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
};

export let mapManagementInstanceChatEventsGetOutput =
  mtMap.object<ManagementInstanceChatEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
    channelId: mtMap.objectField('channel_id', mtMap.passthrough()),
    threadId: mtMap.objectField('thread_id', mtMap.passthrough()),
    messageId: mtMap.objectField('message_id', mtMap.passthrough()),
    authorId: mtMap.objectField('author_id', mtMap.passthrough()),
    providerEventId: mtMap.objectField(
      'provider_event_id',
      mtMap.passthrough()
    ),
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
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

