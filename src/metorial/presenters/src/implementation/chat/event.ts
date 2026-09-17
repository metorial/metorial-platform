import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatEventType } from '../../types';

export let v1ChatEventPresenter = Presenter.create(chatEventType)
  .presenter(async ({ chatEvent, payload }) => ({
    object: 'chat.event' as const,

    id: chatEvent.id,
    type: chatEvent.type,
    source: chatEvent.source,

    chat_connection_id: chatEvent.chatConnection.id,
    chat_id: chatEvent.chat?.id ?? null,
    channel_id: chatEvent.channel?.id ?? null,
    thread_id: chatEvent.thread?.id ?? null,
    message_id: chatEvent.message?.id ?? null,
    author_id: chatEvent.author?.id ?? null,

    provider_event_id: chatEvent.providerEventId,
    provider_channel_id: chatEvent.providerChannelId,
    provider_thread_id: chatEvent.providerThreadId,
    provider_message_id: chatEvent.providerMessageId,
    provider_author_id: chatEvent.providerAuthorId,

    payload: payload ?? null,

    occurred_at: chatEvent.occurredAt,
    created_at: chatEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.event', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat event identifier',
        examples: ['chevt_4dEfGhJkLmNpQrSt']
      }),

      type: v.string({
        name: 'type',
        description: 'What happened in the chat',
        examples: ['message.received', 'reaction.added', 'member.joined']
      }),

      source: v.enumOf(['webhook', 'polling', 'internal'], {
        name: 'source',
        description: 'How Metorial learned about this event'
      }),

      chat_connection_id: v.string({
        name: 'chat_connection_id',
        description: 'The chat connection this event was recorded for',
        examples: ['cin_9jKlMnPqRsTuVwXy']
      }),

      chat_id: v.nullable(
        v.string({
          name: 'chat_id',
          description:
            'The chat this event was recorded for. Null for events recorded before any chat exists, such as a connection or instance lifecycle event.',
          examples: ['cht_4dEfGhJkLmNpQrSt']
        })
      ),

      channel_id: v.nullable(
        v.string({
          name: 'channel_id',
          description:
            'The channel this event happened in. Null when the event is not channel-scoped, or once the channel has been removed.',
          examples: ['cch_2bCdEfGhJkLmNpQr']
        })
      ),

      thread_id: v.nullable(
        v.string({
          name: 'thread_id',
          description:
            'The thread this event happened in. Null when the event is not thread-scoped, or once the thread has been removed.',
          examples: ['cth_6hJkLmNpQrStUvWx']
        })
      ),

      message_id: v.nullable(
        v.string({
          name: 'message_id',
          description:
            'The message this event is about. Null when the event is not about a message, or once the message has been removed.',
          examples: ['cms_8kLmNpQrStUvWxYz']
        })
      ),

      author_id: v.nullable(
        v.string({
          name: 'author_id',
          description:
            'The author who caused this event. Null when no author was involved, or once the author has been removed.',
          examples: ['cau_7dEfGhJkLmNpQrSt']
        })
      ),

      provider_event_id: v.nullable(
        v.string({
          name: 'provider_event_id',
          description:
            "The event's identifier on the chat provider, where the provider supplies one",
          examples: ['Ev024BE91L']
        })
      ),

      provider_channel_id: v.nullable(
        v.string({
          name: 'provider_channel_id',
          description:
            'Provider identifier of the channel this event happened in. Stays readable after the channel has been removed.',
          examples: ['C024BE91L']
        })
      ),

      provider_thread_id: v.nullable(
        v.string({
          name: 'provider_thread_id',
          description:
            'Provider identifier of the thread this event happened in. Stays readable after the thread has been removed.',
          examples: ['1727385600.001700']
        })
      ),

      provider_message_id: v.nullable(
        v.string({
          name: 'provider_message_id',
          description:
            'Provider identifier of the message this event is about. Stays readable after the message has been removed.',
          examples: ['1727385600.001700']
        })
      ),

      provider_author_id: v.nullable(
        v.string({
          name: 'provider_author_id',
          description:
            'Provider identifier of the author who caused this event. Stays readable after the author has been removed.',
          examples: ['U024BE7LH']
        })
      ),

      payload: v.nullable(
        v.record(v.any(), {
          name: 'payload',
          description:
            'The event body, shaped like the chat resource the event is about. Null while the body is unavailable.',
          examples: [{ object: 'chat.message', id: 'cms_8kLmNpQrStUvWxYz' }]
        })
      ),

      occurred_at: v.date({
        name: 'occurred_at',
        description: 'Timestamp when the event happened on the chat provider',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the event was recorded by Metorial',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();

let chatEventListProperties = { ...v1ChatEventPresenter.schema.properties };
delete chatEventListProperties.payload;

export let v1ChatEventListPresenter = Presenter.create(chatEventType)
  .presenter(async ({ chatEvent }, opts) => {
    let { payload: _payload, ...event } = await v1ChatEventPresenter
      .present({ chatEvent }, opts)
      .run();

    return event;
  })
  .schema(v.object(chatEventListProperties) as any)
  .build();

let CHAT_INVOCATION_FAILED_EVENT_TYPE = 'chat.invocation.failed';

export let dashboardChatEventPresenter = Presenter.create(chatEventType)
  .presenter(async ({ chatEvent, payload }, opts) => {
    let inner = await v1ChatEventPresenter.present({ chatEvent, payload }, opts).run();

    let debugPayload =
      chatEvent.type === CHAT_INVOCATION_FAILED_EVENT_TYPE
        ? ((chatEvent.payload as Record<string, any> | null) ?? null)
        : null;
    let error = debugPayload?.error as Record<string, any> | undefined;

    return {
      ...inner,
      error: error
        ? {
            code: error.code ?? null,
            message: error.message ?? null,
            provider_code: error.providerCode ?? null,
            operation: debugPayload?.operation ?? null,
            retryable: error.retryable ?? null,
            retry_after_ms: error.retryAfterMs ?? null,
            target: error.target ?? null
          }
        : null
    };
  })
  .schema(
    v.object({
      ...v1ChatEventPresenter.schema.properties,

      error: v.nullable(
        v.object(
          {
            code: v.nullable(v.string({ description: 'Parsed chat-provider error code' })),
            message: v.nullable(v.string({ description: 'Human-readable error message' })),
            provider_code: v.nullable(
              v.string({ description: "The error code as reported by the provider's own API" })
            ),
            operation: v.nullable(
              v.string({ description: 'The adapter operation that was invoked and failed' })
            ),
            retryable: v.nullable(
              v.boolean({
                description: 'Whether the adapter considers this failure retryable'
              })
            ),
            retry_after_ms: v.nullable(
              v.number({ description: 'Suggested backoff before retrying, in milliseconds' })
            ),
            target: v.nullable(
              v.record(v.any(), { description: 'The provider entity the call failed against' })
            )
          },
          {
            name: 'error',
            description:
              'Debug details for a failed outbound provider call. Only set for chat.invocation.failed events.'
          }
        ) as any
      )
    }) as any
  )
  .build();

let dashboardChatEventListProperties = {
  ...dashboardChatEventPresenter.schema.properties
};
delete dashboardChatEventListProperties.payload;

export let dashboardChatEventListPresenter = Presenter.create(chatEventType)
  .presenter(async ({ chatEvent }, opts) => {
    let { payload: _payload, ...event } = await dashboardChatEventPresenter
      .present({ chatEvent }, opts)
      .run();

    return event;
  })
  .schema(v.object(dashboardChatEventListProperties) as any)
  .build();
