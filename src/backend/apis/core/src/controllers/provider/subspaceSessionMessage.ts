import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionMessageService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { presentSubspaceSessionMessageAs, subspaceSessionMessagePresenter } from '../../presenters';
import { SubspaceSessionMessage } from '../../presenters/types';
import { subspaceSessionGroup } from './subspaceSession';

export let subspaceSessionMessageGroup = subspaceSessionGroup.use(async ctx => {
  if (!ctx.params.sessionMessageId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionMessageId is required',
        description: 'The sessionMessageId path parameter is required.'
      })
    );
  }

  let sessionMessage = await subspaceSessionMessageService.get({
    instance: ctx.instance,
    sessionMessageId: ctx.params.sessionMessageId
  });

  return { sessionMessage };
});

export let subspaceSessionMessageController = Controller.create(
  {
    name: 'Session Messages',
    description:
      'Session messages represent the MCP protocol messages exchanged during a session. This read-only resource provides visibility into the communication between clients and providers.'
  },
  {
    list: subspaceSessionGroup
      .get(instancePath('sessions/:sessionId/messages', 'sessions.messages.list'), {
        name: 'List session messages',
        description: 'Returns a paginated list of messages for a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceSessionMessagePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.string(), { description: 'Filter by message type' }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionMessageService.list({
          instance: ctx.instance,
          sessionIds: [ctx.session.id],
          hierarchy: ['parent', 'child'],
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id)
        });

        let list = await paginator.run(ctx.query);

        let expandedItems: ReturnType<typeof presentSubspaceSessionMessageAs>[] = [];
        for (let sessionMessage of list.items) {
          let msg = sessionMessage as SubspaceSessionMessage;
          let hasInput = !!msg.input;
          let hasOutput = !!msg.output;
          if (hasInput && hasOutput) {
            let req = presentSubspaceSessionMessageAs(msg, 'request');
            let res = presentSubspaceSessionMessageAs(msg, 'response');
            if (req) expandedItems.push(req);
            if (res) expandedItems.push(res);
          } else if (hasInput) {
            let req = presentSubspaceSessionMessageAs(msg, 'request');
            if (req) expandedItems.push(req);
          } else if (hasOutput) {
            let res = presentSubspaceSessionMessageAs(msg, 'response');
            if (res) expandedItems.push(res);
          }
        }

        return {
          items: expandedItems,
          pagination: {
            has_more_after: list.pagination.hasNextPage,
            has_more_before: list.pagination.hasPreviousPage
          }
        };
      }),

    get: subspaceSessionMessageGroup
      .get(
        instancePath(
          'sessions/:sessionId/messages/:sessionMessageId',
          'sessions.messages.get'
        ),
        {
          name: 'Get session message',
          description: 'Retrieves a specific message from a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionMessagePresenter)
      .do(async ctx => {
        return subspaceSessionMessagePresenter.present({ sessionMessage: ctx.sessionMessage });
      })
  }
);
