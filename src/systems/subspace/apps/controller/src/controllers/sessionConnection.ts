import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionConnectionService } from '@metorial-subspace/module-session';
import { sessionConnectionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let sessionConnectionApp = tenantApp.use(async ctx => {
  let sessionConnectionId = ctx.body.sessionConnectionId;
  if (!sessionConnectionId) throw new Error('SessionConnection ID is required');

  let sessionConnection = await sessionConnectionService.getSessionConnectionById({
    sessionConnectionId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { sessionConnection };
});

export let sessionConnectionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          connectionState: v.optional(v.array(v.enumOf(['connected', 'disconnected']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          participantIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionConnectionService.listSessionConnections({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        connectionState: ctx.input.connectionState,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        participantIds: ctx.input.participantIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionConnectionPresenter);
    }),

  get: sessionConnectionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionConnectionId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionConnectionPresenter(ctx.sessionConnection))
});
