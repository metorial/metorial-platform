import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { chatMessageService, chatReactionService } from '@metorial-subspace/module-chat';
import { chatMessagePresenter, chatReactionListPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { chatGroup } from './_shared';

let chatPartsValidator = v.array(
  v.record(v.any(), { description: 'A structured content part of the message' }),
  {
    name: 'parts',
    description: 'Structured content parts making up the message body',
    examples: [[{ type: 'text', text: 'Hello there' }]]
  }
);

let emojiInputValidator = v.union([
  v.string({ description: 'A unicode emoji shortcode, e.g. "tada"' }),
  v.object({
    type: v.literal('unicode'),
    value: v.string({ description: 'The unicode emoji shortcode' })
  }),
  v.object({
    type: v.literal('custom'),
    name: v.string({ description: 'The custom emoji name' }),
    url: v.optional(v.string({ description: 'URL of the custom emoji image' })),
    id: v.optional(v.string({ description: "The custom emoji's identifier on the provider" }))
  })
]);

let chatMessageGroup = chatGroup.use(async ctx => {
  if (!ctx.params.messageId) {
    throw new ServiceError(
      badRequestError({
        message: 'messageId is required',
        description: 'The messageId path parameter is required.'
      })
    );
  }

  return {};
});

export let chatMessageController = Controller.create(
  {
    name: 'Chat Messages',
    description: 'Chat messages are the individual messages sent within a chat channel.'
  },
  {
    list: chatGroup
      .get(instancePath('chats/:chatId/messages', 'chats.messages.list'), {
        name: 'List chat messages',
        description: 'Returns a paginated list of messages in a chat channel.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatMessagePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            channel_id: v.string({
              name: 'channel_id',
              description: 'The channel to list messages for',
              examples: ['cch_2bCdEfGhJkLmNpQr']
            }),
            thread_id: v.optional(
              v.string({ description: 'Filter to messages in this thread' })
            ),
            search: v.optional(v.string({ description: 'Search message content' }))
          })
        )
      )
      .do(async ctx => {
        let paginator = await chatMessageService.listChatMessages({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          threadId: ctx.query.thread_id,
          search: ctx.query.search
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatMessage =>
          chatMessagePresenter.present({ chatMessage })
        );
      }),

    get: chatMessageGroup
      .get(instancePath('chats/:chatId/messages/:messageId', 'chats.messages.get'), {
        name: 'Get chat message',
        description: 'Retrieves a specific chat message.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .query(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this message belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          })
        })
      )
      .output(chatMessagePresenter)
      .do(async ctx => {
        let chatMessage = await chatMessageService.getChatMessage({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          messageId: ctx.params.messageId!
        });

        return chatMessagePresenter.present({ chatMessage });
      }),

    create: chatGroup
      .post(instancePath('chats/:chatId/messages', 'chats.messages.create'), {
        name: 'Send chat message',
        description: 'Sends a new message to a chat channel.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel to send the message to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          }),
          thread_id: v.optional(
            v.string({ description: 'Send the message within this thread' })
          ),
          parts: chatPartsValidator,
          alt_text: v.optional(
            v.string({ description: 'Plain-text fallback for the message' })
          ),
          attachments: v.optional(
            v.array(
              v.object({
                file_id: v.string({ description: 'The Metorial file to attach' })
              })
            )
          ),
          reply_message_id: v.optional(v.string({ description: 'Reply to this message' })),
          ephemeral_target_user_id: v.optional(
            v.string({ description: 'Send this message so only this user can see it' })
          )
        })
      )
      .output(chatMessagePresenter)
      .do(async ctx => {
        let chatMessage = await chatMessageService.sendChatMessage({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.body.channel_id,
          threadId: ctx.body.thread_id,
          body: {
            parts: ctx.body.parts as any,
            altText: ctx.body.alt_text,
            attachments: ctx.body.attachments?.map(attachment => ({
              fileId: attachment.file_id
            }))
          },
          reply: ctx.body.reply_message_id
            ? { messageId: ctx.body.reply_message_id }
            : undefined,
          ephemeral: ctx.body.ephemeral_target_user_id
            ? { targetUserId: ctx.body.ephemeral_target_user_id }
            : undefined
        });

        return chatMessagePresenter.present({ chatMessage });
      }),

    update: chatMessageGroup
      .patch(instancePath('chats/:chatId/messages/:messageId', 'chats.messages.update'), {
        name: 'Edit chat message',
        description: 'Edits a specific chat message.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this message belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          }),
          parts: chatPartsValidator,
          alt_text: v.optional(
            v.string({ description: 'Plain-text fallback for the message' })
          )
        })
      )
      .output(chatMessagePresenter)
      .do(async ctx => {
        let chatMessage = await chatMessageService.editChatMessage({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.body.channel_id,
          messageId: ctx.params.messageId!,
          body: {
            parts: ctx.body.parts as any,
            altText: ctx.body.alt_text
          }
        });

        return chatMessagePresenter.present({ chatMessage });
      }),

    delete: chatMessageGroup
      .delete(instancePath('chats/:chatId/messages/:messageId', 'chats.messages.delete'), {
        name: 'Delete chat message',
        description: 'Deletes a specific chat message.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .query(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this message belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          })
        })
      )
      .output(chatMessagePresenter)
      .do(async ctx => {
        await chatMessageService.deleteChatMessage({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          messageId: ctx.params.messageId!
        });

        let chatMessage = await chatMessageService.getChatMessage({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          messageId: ctx.params.messageId!
        });

        return chatMessagePresenter.present({ chatMessage });
      }),

    markRead: chatMessageGroup
      .post(instancePath('chats/:chatId/messages/:messageId/read', 'chats.messages.read'), {
        name: 'Mark chat message read',
        description: 'Marks a specific chat message as read.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this message belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          }),
          thread_id: v.optional(
            v.string({ description: 'The thread this message belongs to' })
          )
        })
      )
      .output(chatMessagePresenter)
      .do(async ctx => {
        await chatMessageService.markChatMessageRead({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.body.channel_id,
          messageId: ctx.params.messageId!,
          threadId: ctx.body.thread_id
        });

        let chatMessage = await chatMessageService.getChatMessage({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.body.channel_id,
          messageId: ctx.params.messageId!
        });

        return chatMessagePresenter.present({ chatMessage });
      }),

    listReactions: chatMessageGroup
      .get(
        instancePath(
          'chats/:chatId/messages/:messageId/reactions',
          'chats.messages.reactions.list'
        ),
        {
          name: 'List chat message reactions',
          description: 'Returns the reactions left on a specific chat message.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .query(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this message belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          })
        })
      )
      .output(chatReactionListPresenter)
      .do(async ctx => {
        let { reactions } = await chatReactionService.listChatReactions({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          messageId: ctx.params.messageId!
        });

        return chatReactionListPresenter.present({ reactions: reactions as any });
      }),

    addReaction: chatMessageGroup
      .post(
        instancePath(
          'chats/:chatId/messages/:messageId/reactions',
          'chats.messages.reactions.create'
        ),
        {
          name: 'Add chat message reaction',
          description: 'Adds a reaction to a specific chat message.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this message belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          }),
          emoji: emojiInputValidator
        })
      )
      .output(chatReactionListPresenter)
      .do(async ctx => {
        await chatReactionService.addChatReaction({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.body.channel_id,
          messageId: ctx.params.messageId!,
          emoji: ctx.body.emoji as any
        });

        let { reactions } = await chatReactionService.listChatReactions({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.body.channel_id,
          messageId: ctx.params.messageId!
        });

        return chatReactionListPresenter.present({ reactions: reactions as any });
      }),

    removeReaction: chatMessageGroup
      .delete(
        instancePath(
          'chats/:chatId/messages/:messageId/reactions',
          'chats.messages.reactions.delete'
        ),
        {
          name: 'Remove chat message reaction',
          description: 'Removes a reaction from a specific chat message.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .query(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this message belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          }),
          emoji: v.string({
            name: 'emoji',
            description: 'The unicode emoji shortcode to remove',
            examples: ['tada']
          })
        })
      )
      .output(chatReactionListPresenter)
      .do(async ctx => {
        await chatReactionService.removeChatReaction({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          messageId: ctx.params.messageId!,
          emoji: ctx.query.emoji
        });

        let { reactions } = await chatReactionService.listChatReactions({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          messageId: ctx.params.messageId!
        });

        return chatReactionListPresenter.present({ reactions: reactions as any });
      })
  }
);
