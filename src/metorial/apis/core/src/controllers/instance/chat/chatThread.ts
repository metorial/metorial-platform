import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { chatThreadService } from '@metorial-subspace/module-chat';
import { chatThreadPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { chatGroup } from './_shared';

let threadTypeValidator = v.enumOf(['conversation', 'dm', 'post']);

export let chatThreadController = Controller.create(
  {
    name: 'Chat Threads',
    description: 'Chat threads group replies to a message within a chat channel.'
  },
  {
    list: chatGroup
      .get(instancePath('chats/:chatId/threads', 'chats.threads.list'), {
        name: 'List chat threads',
        description: 'Returns a paginated list of threads in a chat channel.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatThreadPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            channel_id: v.string({
              name: 'channel_id',
              description: 'The channel to list threads for',
              examples: ['cch_2bCdEfGhJkLmNpQr']
            }),
            type: v.optional(threadTypeValidator, { description: 'Filter by thread type' })
          })
        )
      )
      .do(async ctx => {
        let paginator = await chatThreadService.listChatThreads({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          type: ctx.query.type
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatThread =>
          chatThreadPresenter.present({ chatThread })
        );
      }),

    get: chatGroup
      .get(instancePath('chats/:chatId/threads/:threadId', 'chats.threads.get'), {
        name: 'Get chat thread',
        description: 'Retrieves a specific chat thread.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .query(
        'default',
        v.object({
          channel_id: v.string({
            name: 'channel_id',
            description: 'The channel this thread belongs to',
            examples: ['cch_2bCdEfGhJkLmNpQr']
          })
        })
      )
      .output(chatThreadPresenter)
      .do(async ctx => {
        if (!ctx.params.threadId) {
          throw new ServiceError(
            badRequestError({
              message: 'threadId is required',
              description: 'The threadId path parameter is required.'
            })
          );
        }

        let chatThread = await chatThreadService.getChatThread({
          instance: ctx.instance,
          chat: ctx.chat,
          channelId: ctx.query.channel_id,
          threadId: ctx.params.threadId
        });

        return chatThreadPresenter.present({ chatThread });
      })
  }
);
