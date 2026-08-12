import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionMessageService } from '@metorial-subspace/module-session';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  constrainFineGrainedSessionQuery,
  getFineGrainedAllowedSessionIds,
  requireFineGrainedSessionFromResource
} from '../../../middleware/checkFineGrainedSessionAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { subspaceSessionMessagePresenter } from '@metorial/presenters';

let sessionMessageGroup = instanceGroup
  .use(async ctx => {
    if (!ctx.params.sessionMessageId) {
      throw new ServiceError(
        badRequestError({
          message: 'sessionMessageId is required',
          description: 'The sessionMessageId path parameter is required.'
        })
      );
    }

    let sessionMessage = await sessionMessageService.getSessionMessageById({
      instance: ctx.instance,
      sessionMessageId: ctx.params.sessionMessageId
    });

    return { sessionMessage };
  })
  .use(
    requireFineGrainedSessionFromResource(
      ctx =>
        ctx.sessionMessage?.sessionId ??
        ctx.sessionMessage?.session_id ??
        ctx.sessionMessage?.session?.id
    )()
  );

export let sessionMessageController = Controller.create(
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
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .use(constrainFineGrainedSessionQuery('session_id')())
      .outputList(subspaceSessionMessagePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(
              v.union([
                v.enumOf(['unknown', 'tool_call', 'mcp_control', 'mcp_message']),
                v.array(v.enumOf(['unknown', 'tool_call', 'mcp_control', 'mcp_message']))
              ]),
              { description: 'Filter by message type(s)' }
            ),
            source: v.optional(
              v.union([
                v.enumOf(['provider', 'client']),
                v.array(v.enumOf(['provider', 'client']))
              ]),
              { description: 'Filter by message source(s)' }
            ),
            hierarchy: v.optional(
              v.union([v.enumOf(['child', 'parent']), v.array(v.enumOf(['child', 'parent']))]),
              { description: 'Filter by message hierarchy' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by message ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            session_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session connection ID(s)'
            }),
            provider_run_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider run ID(s)'
            }),
            error_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by error ID(s)'
            }),
            participant_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by participant ID(s)'
            }),
            parent_message_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by parent message ID(s)'
            }),
            created_at: dateFilterValidator('session message creation time'),
            updated_at: dateFilterValidator('session message last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await sessionMessageService.listSessionMessages({
          instance: ctx.instance,
          accessTagSessionIds: getFineGrainedAllowedSessionIds(ctx),
          allowDeleted: false,
          types: normalizeArrayParam(ctx.query.type),
          source: normalizeArrayParam(ctx.query.source),
          hierarchy: normalizeArrayParam(ctx.query.hierarchy),
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          providerRunIds: normalizeArrayParam(ctx.query.provider_run_id),
          errorIds: normalizeArrayParam(ctx.query.error_id),
          participantIds: normalizeArrayParam(ctx.query.participant_id),
          parentMessageIds: normalizeArrayParam(ctx.query.parent_message_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionMessage =>
          subspaceSessionMessagePresenter.present({
            sessionMessage
          })
        );
      }),

    get: sessionMessageGroup
      .get(instancePath('session-messages/:sessionMessageId', 'sessions.messages.get'), {
        name: 'Get session message',
        description: 'Retrieves a specific message from a session.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .output(subspaceSessionMessagePresenter)
      .do(async ctx => {
        return subspaceSessionMessagePresenter.present({ sessionMessage: ctx.sessionMessage });
      })
  }
);
