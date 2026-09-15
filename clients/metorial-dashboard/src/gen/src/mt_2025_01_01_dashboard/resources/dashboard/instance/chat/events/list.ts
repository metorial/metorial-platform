import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceChatEventsListOutput = {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceChatEventsListOutput =
  mtMap.object<DashboardInstanceChatEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          error: mtMap.objectField(
            'error',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough()),
              providerCode: mtMap.objectField(
                'provider_code',
                mtMap.passthrough()
              ),
              operation: mtMap.objectField('operation', mtMap.passthrough()),
              retryable: mtMap.objectField('retryable', mtMap.passthrough()),
              retryAfterMs: mtMap.objectField(
                'retry_after_ms',
                mtMap.passthrough()
              ),
              target: mtMap.objectField('target', mtMap.passthrough())
            })
          )
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceChatEventsListQuery = {
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

export let mapDashboardInstanceChatEventsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      chatId: mtMap.objectField(
        'chat_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      chatConnectionId: mtMap.objectField(
        'chat_connection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      chatInstanceId: mtMap.objectField(
        'chat_instance_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      type: mtMap.objectField(
        'type',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      occurredAt: mtMap.objectField(
        'occurred_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

