import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatThreadType } from '../../types';
import { chatContextSchema } from './channel';

export let v1ChatThreadPresenter = Presenter.create(chatThreadType)
  .presenter(async ({ chatThread }) => ({
    object: 'chat.thread' as const,

    id: chatThread.id,
    chat_id: chatThread.chat.id,
    channel_id: chatThread.channel.id,

    type: chatThread.type,
    provider_type: chatThread.providerType,
    provider_thread_id: chatThread.threadId,
    provider_root_message_id: chatThread.rootMessageId,

    subject: chatThread.subject,
    permalink: chatThread.permalink,
    context: (chatThread.context as Record<string, any> | null) ?? null,

    reply_count: chatThread.replyCount,
    last_reply_at: chatThread.lastReplyAt,

    created_at: chatThread.createdAt,
    updated_at: chatThread.updatedAt,
    last_interaction_at: chatThread.lastInteractionAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.thread', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat thread identifier',
        examples: ['cth_6hJkLmNpQrStUvWx']
      }),

      chat_id: v.string({
        name: 'chat_id',
        description: 'The chat this thread belongs to',
        examples: ['cht_4dEfGhJkLmNpQrSt']
      }),

      channel_id: v.string({
        name: 'channel_id',
        description: 'The channel this thread was started in',
        examples: ['cch_2bCdEfGhJkLmNpQr']
      }),

      type: v.enumOf(['conversation', 'dm', 'post'], {
        name: 'type',
        description: 'How the thread is scoped on the chat provider'
      }),

      provider_type: v.string({
        name: 'provider_type',
        description: "The provider's own name for this kind of thread",
        examples: ['message_thread']
      }),

      provider_thread_id: v.string({
        name: 'provider_thread_id',
        description: "The thread's identifier on the chat provider",
        examples: ['1727385600.001700']
      }),

      provider_root_message_id: v.nullable(
        v.string({
          name: 'provider_root_message_id',
          description:
            'Provider identifier of the message the thread was started from, if the provider reports one',
          examples: ['1727385600.001700']
        })
      ),

      subject: v.nullable(
        v.string({
          name: 'subject',
          description: 'Subject of the thread',
          examples: ['Invoice not received']
        })
      ),

      permalink: v.nullable(
        v.string({
          name: 'permalink',
          description: 'Link to the thread on the chat provider',
          examples: ['https://acme.slack.com/archives/C024BE91L/p1727385600001700']
        })
      ),

      context: chatContextSchema,

      reply_count: v.nullable(
        v.number({
          name: 'reply_count',
          description: 'Number of replies in the thread, if the provider reports it',
          examples: [7]
        })
      ),

      last_reply_at: v.nullable(
        v.date({
          name: 'last_reply_at',
          description: 'Timestamp of the most recent reply, if the provider reports it',
          examples: [new Date('2026-01-10T14:45:00Z')]
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the thread was first seen by Metorial',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the thread was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      last_interaction_at: v.nullable(
        v.date({
          name: 'last_interaction_at',
          description: 'Timestamp of the last activity Metorial saw in this thread',
          examples: [new Date('2026-01-10T14:45:00Z')]
        })
      )
    })
  )
  .build();
