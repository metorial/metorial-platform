import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { chatEventService } from '@metorial-subspace/module-chat';
import { chatEventListPresenter, chatEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

export let chatEventController = Controller.create(
  {
    name: 'Chat Events',
    description:
      'Chat events record what happened on a chat, such as a new message, reaction, or membership change.'
  },
  {
    list: instanceGroup
      .get(instancePath('chat/events', 'chat.events.list'), {
        name: 'List chat events',
        description: 'Returns a paginated list of chat events.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatEventListPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            chat_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by chat ID(s)'
            }),
            chat_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by chat connection ID(s)'
            }),
            chat_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by chat instance ID(s)'
            }),
            type: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by event type(s)'
            }),
            created_at: dateFilterValidator('chat event creation time'),
            occurred_at: dateFilterValidator('chat event occurrence time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await chatEventService.listChatEvents({
          instance: ctx.instance,
          chatIds: normalizeArrayParam(ctx.query.chat_id),
          chatConnectionIds: normalizeArrayParam(ctx.query.chat_connection_id),
          chatInstanceIds: normalizeArrayParam(ctx.query.chat_instance_id),
          types: normalizeArrayParam(ctx.query.type),
          createdAt: ctx.query.created_at,
          occurredAt: ctx.query.occurred_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatEvent =>
          chatEventListPresenter.present({ chatEvent })
        );
      }),

    get: instanceGroup
      .get(instancePath('chat/events/:chatEventId', 'chat.events.get'), {
        name: 'Get chat event',
        description: 'Retrieves a specific chat event.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatEventPresenter)
      .do(async ctx => {
        if (!ctx.params.chatEventId) {
          throw new ServiceError(
            badRequestError({
              message: 'chatEventId is required',
              description: 'The chatEventId path parameter is required.'
            })
          );
        }

        let { chatEvent, payload } = await chatEventService.getChatEventById({
          instance: ctx.instance,
          chatEventId: ctx.params.chatEventId
        });

        return chatEventPresenter.present({ chatEvent, payload });
      })
  }
);
