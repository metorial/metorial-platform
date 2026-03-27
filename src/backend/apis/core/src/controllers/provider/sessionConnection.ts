import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceSessionConnectionService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import {
  constrainFineGrainedSessionQuery,
  getFineGrainedAllowedSessionIds,
  requireFineGrainedSessionFromResource
} from '../../middleware/checkFineGrainedSessionAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionConnectionPresenter } from '../../presenters';

let sessionConnectionGroup = instanceGroup
  .use(async ctx => {
    if (!ctx.params.sessionConnectionId) {
      throw new ServiceError(
        badRequestError({
          message: 'sessionConnectionId is required',
          description: 'The sessionConnectionId path parameter is required.'
        })
      );
    }

    let sessionConnection = await subspaceSessionConnectionService.get({
      instance: ctx.instance,
      sessionConnectionId: ctx.params.sessionConnectionId
    });

    return { sessionConnection };
  })
  .use(
    requireFineGrainedSessionFromResource(
      ctx =>
        ctx.sessionConnection?.sessionId ??
        ctx.sessionConnection?.session_id ??
        ctx.sessionConnection?.session?.id
    )()
  );

export let sessionConnectionController = Controller.create(
  {
    name: 'Session Connections',
    description:
      'Session connections represent the MCP connections established within a session. This read-only resource provides visibility into the connection state and capabilities.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-connections', 'sessions.connections.list'), {
        name: 'List session connections',
        description: 'Returns a paginated list of connections for a session.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .use(constrainFineGrainedSessionQuery('session_id')())
      .outputList(subspaceSessionConnectionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by connection status' }
            ),
            connection_state: v.optional(
              v.union([
                v.enumOf(['connected', 'disconnected']),
                v.array(v.enumOf(['connected', 'disconnected']))
              ]),
              {
                description: 'Filter by connection state'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session connection ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            participant_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by participant ID(s)'
            }),
            created_at: dateFilterValidator('session connection creation time'),
            updated_at: dateFilterValidator('session connection last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionConnectionService.list({
          instance: ctx.instance,
          accessTagSessionIds: getFineGrainedAllowedSessionIds(ctx),
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          status: normalizeArrayParam(ctx.query.status),
          connectionState: normalizeArrayParam(ctx.query.connection_state),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          participantIds: normalizeArrayParam(ctx.query.participant_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionConnection =>
          subspaceSessionConnectionPresenter.present({
            sessionConnection
          })
        );
      }),

    get: sessionConnectionGroup
      .get(
        instancePath('session-connections/:sessionConnectionId', 'sessions.connections.get'),
        {
          name: 'Get session connection',
          description: 'Retrieves a specific connection from a session.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .output(subspaceSessionConnectionPresenter)
      .do(async ctx => {
        return subspaceSessionConnectionPresenter.present({
          sessionConnection: ctx.sessionConnection
        });
      })
  }
);
