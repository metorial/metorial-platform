import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceSessionConnectionService,
  type SubspaceSessionConnection
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceSessionConnectionPresenter } from '../../presenters';

export let subspaceSessionConnectionGroup = instanceGroup.use(async ctx => {
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
});

export let subspaceSessionConnectionController = Controller.create(
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
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(subspaceSessionConnectionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(v.string(), { description: 'Filter by connection status' }),
            connection_state: v.optional(v.string(), {
              description: 'Filter by connection state'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            })

            //             status: ("active" | "archived")[] | undefined;
            // connectionState: ("connected" | "disconnected")[] | undefined;
            // ids: string[] | undefined;
            // sessionIds: string[] | undefined;
            // sessionProviderIds: string[] | undefined;
            // participantIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionConnectionService.list({
          instance: ctx.instance,
          sessionIds: [ctx.session.id],
          status: ctx.query.status
            ? ([ctx.query.status] as ('active' | 'archived')[])
            : undefined,
          connectionState: ctx.query.connection_state
            ? ([ctx.query.connection_state] as ('connected' | 'disconnected')[])
            : undefined,
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionConnection =>
          subspaceSessionConnectionPresenter.present({
            sessionConnection: sessionConnection as SubspaceSessionConnection
          })
        );
      }),

    get: subspaceSessionConnectionGroup
      .get(
        instancePath('session-connections/:sessionConnectionId', 'sessions.connections.get'),
        {
          name: 'Get session connection',
          description: 'Retrieves a specific connection from a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(subspaceSessionConnectionPresenter)
      .do(async ctx => {
        return subspaceSessionConnectionPresenter.present({
          sessionConnection: ctx.sessionConnection
        });
      })
  }
);
