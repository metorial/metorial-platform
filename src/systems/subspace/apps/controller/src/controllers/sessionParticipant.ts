import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionParticipantService } from '@metorial-subspace/module-session';
import { sessionParticipantPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let sessionParticipantApp = tenantApp.use(async ctx => {
  let sessionParticipantId = ctx.body.sessionParticipantId;
  if (!sessionParticipantId) throw new Error('SessionParticipant ID is required');

  let sessionParticipant = await sessionParticipantService.getSessionParticipantById({
    sessionParticipantId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { sessionParticipant };
});

export let sessionParticipantController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          types: v.optional(
            v.array(
              v.enumOf([
                'unknown',
                'provider',
                'agent',
                'system',

                // Legacy
                'mcp_client',
                'metorial_protocol_client',
                'tool_call'
              ])
            )
          ),

          connectionTypes: v.optional(
            v.array(v.enumOf(['mcp', 'metorial_protocol', 'tool_call']))
          ),

          ids: v.optional(v.array(v.string())),
          agentIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          agentInstanceIds: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionConnectionIds: v.optional(v.array(v.string())),
          sessionMessageIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionParticipantService.listSessionParticipants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        types: ctx.input.types?.flatMap(t => {
          if (
            t === 'mcp_client' ||
            t === 'metorial_protocol_client' ||
            t === 'tool_call' ||
            t === 'agent'
          ) {
            return [
              'legacy_mcp_client',
              'legacy_metorial_protocol_client',
              'legacy_tool_call',
              'agent'
            ] as const;
          }

          return t;
        }),

        connectionTypes: ctx.input.connectionTypes,
        ids: ctx.input.ids,
        agentIds: ctx.input.agentIds,
        actorIds: ctx.input.actorIds,
        agentInstanceIds: ctx.input.agentInstanceIds,
        sessionIds: ctx.input.sessionIds,
        sessionConnectionIds: ctx.input.sessionConnectionIds,
        sessionMessageIds: ctx.input.sessionMessageIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionParticipantPresenter);
    }),

  get: sessionParticipantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionParticipantId: v.string()
      })
    )
    .do(async ctx => sessionParticipantPresenter(ctx.sessionParticipant))
});
