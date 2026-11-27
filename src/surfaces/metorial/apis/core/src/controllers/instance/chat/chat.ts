import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { chatService } from '@metorial-subspace/module-chat';
import { chatPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { chatGroup } from './_shared';

export let chatController = Controller.create(
  {
    name: 'Chats',
    description:
      'A chat represents a single connected chat surface, such as a Slack or Microsoft Teams tenant, running on a chat instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('chats', 'chats.list'), {
        name: 'List chats',
        description: 'Returns a paginated list of chats.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), { description: 'Search by name' }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              { description: 'Only return chats with one of these statuses.' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return chats with one of these IDs.'
            }),
            chat_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return chats for one of these chat connections.'
            }),
            chat_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return chats for one of these chat instances.'
            }),
            chat_instance_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return chats for one of these chat instance providers.'
            }),
            created_at: dateFilterValidator('chat creation time'),
            updated_at: dateFilterValidator('chat last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await chatService.listChats({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          chatConnectionIds: normalizeArrayParam(ctx.query.chat_connection_id),
          chatInstanceIds: normalizeArrayParam(ctx.query.chat_instance_id),
          chatInstanceProviderIds: normalizeArrayParam(ctx.query.chat_instance_provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chat => chatPresenter.present({ chat }));
      }),

    get: chatGroup
      .get(instancePath('chats/:chatId', 'chats.get'), {
        name: 'Get chat',
        description: 'Retrieves a chat.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatPresenter)
      .do(async ctx => chatPresenter.present({ chat: ctx.chat }))
  }
);
