import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { sessionErrorService } from '@metorial-subspace/module-session';
import { sessionErrorPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let sessionErrorApp = tenantApp.use(async ctx => {
  let sessionErrorId = ctx.body.sessionErrorId;
  if (!sessionErrorId) throw new Error('SessionError ID is required');

  let sessionError = await sessionErrorService.getSessionErrorById({
    sessionErrorId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { sessionError };
});

export let sessionErrorController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          allowDeleted: v.optional(v.boolean()),

          types: v.optional(
            v.array(
              v.enumOf([
                'message_processing_timeout',
                'message_processing_provider_error',
                'message_processing_system_error'
              ])
            )
          ),

          ids: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          sessionConnectionIds: v.optional(v.array(v.string())),
          providerRunIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          sessionMessageIds: v.optional(v.array(v.string())),
          sessionErrorGroupIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionErrorService.listSessionErrors({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        allowDeleted: ctx.input.allowDeleted,

        types: ctx.input.types,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        sessionConnectionIds: ctx.input.sessionConnectionIds,
        providerRunIds: ctx.input.providerRunIds,
        providerIds: ctx.input.providerIds,
        sessionMessageIds: ctx.input.sessionMessageIds,
        sessionErrorGroupIds: ctx.input.sessionErrorGroupIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionErrorPresenter);
    }),

  get: sessionErrorApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionErrorId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionErrorPresenter(ctx.sessionError))
});
