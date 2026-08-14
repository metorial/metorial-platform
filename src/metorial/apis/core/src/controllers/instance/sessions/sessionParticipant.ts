import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { SessionParticipantType } from '@metorial-subspace/db';
import { sessionParticipantService } from '@metorial-subspace/module-session';
import { Controller } from '@metorial/rest';
import { resolveActorIdsForLogFilters } from './_logFilterActors';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  constrainFineGrainedSessionQuery,
  getFineGrainedAllowedSessionIds,
  requireFineGrainedSessionFromResource
} from '../../../middleware/checkFineGrainedSessionAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { sessionParticipantPresenter } from '@metorial/presenters';

let normalizeParticipantTypes = (
  types:
    | (
        | 'unknown'
        | 'provider'
        | 'system'
        | 'tool_call'
        | 'mcp_client'
        | 'metorial_protocol_client'
      )[]
    | undefined
): SessionParticipantType[] | undefined =>
  types?.map(type => {
    if (type === 'tool_call') return 'legacy_tool_call';
    if (type === 'mcp_client') return 'legacy_mcp_client';
    if (type === 'metorial_protocol_client') return 'legacy_metorial_protocol_client';
    return type;
  });

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

    let sessionParticipant = await sessionParticipantService.getSessionParticipantById({
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
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
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
            agent_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by connected agent ID(s)'
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by connected identity actor ID(s)'
            }),
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by connected consumer ID(s)'
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by connected identity ID(s)'
            }),
            agent_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by connected agent instance ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session connection ID(s)'
            }),
            session_message_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session message ID(s)'
            }),
            created_at: dateFilterValidator('session participant creation time'),
            updated_at: dateFilterValidator('session participant last update time')
          })
        )
      )
      .do(async ctx => {
        let actorIds = await resolveActorIdsForLogFilters({
          instance: ctx.instance,
          actorIds: normalizeArrayParam(ctx.query.actor_id),
          consumerIds: normalizeArrayParam(ctx.query.consumer_id)
        });

        let paginator = await sessionParticipantService.listSessionParticipants({
          instance: ctx.instance,
          accessTagSessionIds: getFineGrainedAllowedSessionIds(ctx),
          types: normalizeParticipantTypes(normalizeArrayParam(ctx.query.type)),
          ids: normalizeArrayParam(ctx.query.id),
          agentIds: normalizeArrayParam(ctx.query.agent_id),
          actorIds,
          identityIds: normalizeArrayParam(ctx.query.identity_id),
          agentInstanceIds: normalizeArrayParam(ctx.query.agent_instance_id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionConnectionIds: normalizeArrayParam(ctx.query.session_connection_id),
          sessionMessageIds: normalizeArrayParam(ctx.query.session_message_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
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
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .output(sessionParticipantPresenter)
      .do(async ctx => {
        return sessionParticipantPresenter.present({
          sessionParticipant: ctx.sessionParticipant
        });
      })
  }
);
