import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionParticipantService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import {
  constrainFineGrainedSessionQuery,
  getFineGrainedAllowedSessionIds,
  requireFineGrainedSessionFromResource
} from '../../middleware/checkFineGrainedSessionAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { sessionParticipantPresenter } from '../../presenters';

let sessionParticipantGroup = instanceGroup
  .use(async ctx => {
    if (!ctx.params.sessionParticipantId) {
      throw new ServiceError(
        badRequestError({
          message: 'sessionParticipantId is required',
          description: 'The sessionParticipantId path parameter is required.'
        })
      );
    }

    let sessionParticipant = await subspaceSessionParticipantService.get({
      instance: ctx.instance,
      sessionParticipantId: ctx.params.sessionParticipantId
    });

    return { sessionParticipant };
  })
  .use(
    requireFineGrainedSessionFromResource(
      ctx =>
        ctx.sessionParticipant?.sessionId ??
        ctx.sessionParticipant?.session_id ??
        ctx.sessionParticipant?.session?.id
    )()
  );

export let sessionParticipantController = Controller.create(
  {
    name: 'Session Participants',
    description:
      'Session participants represent the clients and other entities that are connected to a session. This read-only resource tracks who is participating in a session.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-participants', 'sessions.participants.list'), {
        name: 'List session participants',
        description: 'Returns a paginated list of participants in a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'], fineGrainedPolicy: 'allow' }))
      .use(constrainFineGrainedSessionQuery('session_id')())
      .outputList(sessionParticipantPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(
              v.union([
                v.enumOf([
                  'unknown',
                  'provider',
                  'system',
                  'tool_call',
                  'mcp_client',
                  'metorial_protocol_client'
                ]),
                v.array(
                  v.enumOf([
                    'unknown',
                    'provider',
                    'system',
                    'tool_call',
                    'mcp_client',
                    'metorial_protocol_client'
                  ])
                )
              ]),
              { description: 'Filter by participant type(s)' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by participant ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session connection ID(s)'
            }),
            session_message_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session message ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionParticipantService.list({
          instance: ctx.instance,
          accessTagSessionIds: getFineGrainedAllowedSessionIds(ctx),
          types: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          sessionMessageIds: normalizeArrayParam(ctx.query.session_message_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionParticipant =>
          sessionParticipantPresenter.present({ sessionParticipant })
        );
      }),

    get: sessionParticipantGroup
      .get(
        instancePath(
          'session-participants/:sessionParticipantId',
          'sessions.participants.get'
        ),
        {
          name: 'Get session participant',
          description: 'Retrieves a specific participant in a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'], fineGrainedPolicy: 'allow' }))
      .output(sessionParticipantPresenter)
      .do(async ctx => {
        return sessionParticipantPresenter.present({
          sessionParticipant: ctx.sessionParticipant
        });
      })
  }
);
