import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { SessionEventType } from '@metorial-subspace/db';
import { sessionEventService } from '@metorial-subspace/module-session';
import { sessionEventPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let sessionEventApp = tenantApp.use(async ctx => {
  let sessionEventId = ctx.body.sessionEventId;
  if (!sessionEventId) throw new Event('SessionEvent ID is required');

  let sessionEvent = await sessionEventService.getSessionEventById({
    sessionEventId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { sessionEvent };
});

export let sessionEventController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          allowDeleted: v.optional(v.boolean()),

          types: v.optional(v.array(v.enumOf(Object.values(SessionEventType) as any))),

          ids: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          sessionConnectionIds: v.optional(v.array(v.string())),
          providerRunIds: v.optional(v.array(v.string())),
          sessionMessageIds: v.optional(v.array(v.string())),
          sessionErrorIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionEventService.listSessionEvents({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        allowDeleted: ctx.input.allowDeleted,

        types: ctx.input.types as any,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        sessionConnectionIds: ctx.input.sessionConnectionIds,
        providerRunIds: ctx.input.providerRunIds,
        sessionMessageIds: ctx.input.sessionMessageIds,
        sessionErrorIds: ctx.input.sessionErrorIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionEventPresenter);
    }),

  get: sessionEventApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionEventId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionEventPresenter(ctx.sessionEvent))
});
