import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceSessionMessageService,
  type SubspaceSessionMessage
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionMessagePresenter } from '../../presenters';

export let subspaceSessionMessageGroup = instanceGroup.use(async ctx => {
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
    list: instanceGroup
      .get(instancePath('session-messages', 'sessions.messages.list'), {
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

            //             types: ("unknown" | "tool_call" | "mcp_control" | "mcp_message")[] | undefined;
            // source: ("provider" | "client")[] | undefined;
            // hierarchy: ("child" | "parent")[] | undefined;
            // ids: string[] | undefined;
            // sessionIds: string[] | undefined;
            // sessionProviderIds: string[] | undefined;
            // sessionConnectionIds: string[] | undefined;
            // providerRunIds: string[] | undefined;
            // errorIds: string[] | undefined;
            // participantIds: string[] | undefined;
            // parentMessageIds: string[] | undefined;
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

        return Paginator.present(list, sessionMessage =>
          subspaceSessionMessagePresenter.present({
            sessionMessage: sessionMessage as SubspaceSessionMessage
          })
        );
      }),

    get: subspaceSessionMessageGroup
      .get(instancePath('session-messages/:sessionMessageId', 'sessions.messages.get'), {
        name: 'Get session message',
        description: 'Retrieves a specific message from a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionMessagePresenter)
      .do(async ctx => {
        return subspaceSessionMessagePresenter.present({ sessionMessage: ctx.sessionMessage });
      })
  }
);
