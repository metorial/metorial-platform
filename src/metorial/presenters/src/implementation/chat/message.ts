import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatMessageType } from '../../types';
import { v1ChatAuthorPresenter } from './author';
import { v1ChatMessageAttachmentPresenter } from './messageAttachment';

export let v1ChatMessagePresenter = Presenter.create(chatMessageType)
  .presenter(async ({ chatMessage }, opts) => ({
    object: 'chat.message' as const,

    id: chatMessage.id,
    chat_id: chatMessage.chat.id,
    channel_id: chatMessage.channel.id,
    thread_id: chatMessage.thread?.id ?? null,

    provider_type: chatMessage.providerType,
    provider_message_id: chatMessage.messageId,
    provider_reply_to_message_id: chatMessage.replyToMessageId,

    author: chatMessage.author
      ? await v1ChatAuthorPresenter
          .present({ chatAuthor: { ...chatMessage.author, chat: chatMessage.chat } }, opts)
          .run()
      : null,

    body: (chatMessage.body as Record<string, any> | null) ?? null,
    reactions: (chatMessage.reactions as Record<string, any>[] | null) ?? null,
    unfurls: (chatMessage.unfurls as Record<string, any>[] | null) ?? null,

    attachments: await Promise.all(
      chatMessage.attachments.map(chatMessageAttachment =>
        v1ChatMessageAttachmentPresenter.present({ chatMessageAttachment }, opts).run()
      )
    ),

    sent_at: chatMessage.sentAt,
    edited: chatMessage.edited,
    edited_at: chatMessage.editedAt,

    created_at: chatMessage.createdAt,
    updated_at: chatMessage.updatedAt,
    last_interaction_at: chatMessage.lastInteractionAt,
    deleted_at: chatMessage.deletedAt
  }))
  .schema(
    v.object({
      object: v.literal('chat.message', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat message identifier',
        examples: ['cms_8kLmNpQrStUvWxYz']
      }),

      chat_id: v.string({
        name: 'chat_id',
        description: 'The chat this message belongs to',
        examples: ['cht_4dEfGhJkLmNpQrSt']
      }),

      channel_id: v.string({
        name: 'channel_id',
        description: 'The channel this message was sent in',
        examples: ['cch_2bCdEfGhJkLmNpQr']
      }),

      thread_id: v.nullable(
        v.string({
          name: 'thread_id',
          description: 'The thread this message was sent in, if it was sent in one',
          examples: ['cth_6hJkLmNpQrStUvWx']
        })
      ),

      provider_type: v.string({
        name: 'provider_type',
        description: "The provider's own name for this kind of message",
        examples: ['message']
      }),

      provider_message_id: v.string({
        name: 'provider_message_id',
        description: "The message's identifier on the chat provider",
        examples: ['1727385600.001700']
      }),

      provider_reply_to_message_id: v.nullable(
        v.string({
          name: 'provider_reply_to_message_id',
          description:
            'Provider identifier of the message this one replies to, if it is a reply',
          examples: ['1727385500.001200']
        })
      ),

      // Null only when the message was first seen as a deletion, which carries no author.
      author: v.nullable(v1ChatAuthorPresenter.schema),

      body: v.nullable(
        v.record(v.any(), {
          name: 'body',
          description:
            'Structured content of the message. Null once the message has been deleted.',
          examples: [{ parts: [{ type: 'text', text: 'Hello there' }] }]
        })
      ),

      reactions: v.nullable(
        v.array(
          v.record(v.any(), {
            name: 'reactions',
            description: 'Reactions left on the message'
          }),
          {
            name: 'reactions',
            description: 'Reactions left on the message, as reported by the provider',
            examples: [[{ emoji: { name: 'tada' }, count: 3 }]]
          }
        )
      ),

      unfurls: v.nullable(
        v.array(
          v.record(v.any(), {
            name: 'unfurls',
            description: 'Link preview attached to the message'
          }),
          {
            name: 'unfurls',
            description: 'Link previews the provider generated for the message',
            examples: [[{ url: 'https://example.com', title: 'Example' }]]
          }
        )
      ),

      attachments: v.array(v1ChatMessageAttachmentPresenter.schema, {
        name: 'attachments',
        description: 'Files attached to the message'
      }),

      sent_at: v.date({
        name: 'sent_at',
        description: 'Timestamp when the message was sent on the chat provider',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      edited: v.boolean({
        name: 'edited',
        description: 'Whether the message has been edited since it was sent'
      }),

      edited_at: v.nullable(
        v.date({
          name: 'edited_at',
          description: 'Timestamp when the message was last edited',
          examples: [new Date('2026-01-10T14:50:00Z')]
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the message was first seen by Metorial',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the message was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      last_interaction_at: v.nullable(
        v.date({
          name: 'last_interaction_at',
          description: 'Timestamp of the last activity Metorial saw on this message',
          examples: [new Date('2026-01-10T14:45:00Z')]
        })
      ),

      deleted_at: v.nullable(
        v.date({
          name: 'deleted_at',
          description:
            'Timestamp when the message was deleted on the chat provider. Deleted messages keep their identity but lose their content.',
          examples: [new Date('2026-01-10T15:00:00Z')]
        })
      )
    })
  )
  .build();
