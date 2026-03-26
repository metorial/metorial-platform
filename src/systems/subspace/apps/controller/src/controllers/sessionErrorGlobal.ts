import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionErrorGroupService } from '@metorial-subspace/module-session';
import { sessionErrorGroupPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let sessionErrorGroupApp = tenantApp.use(async ctx => {
  let sessionErrorGroupId = ctx.body.sessionErrorGroupId;
  if (!sessionErrorGroupId) throw new Error('SessionErrorGroup ID is required');

  let sessionErrorGroup = await sessionErrorGroupService.getSessionErrorGroupById({
    sessionErrorGroupId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { sessionErrorGroup };
});

export let sessionErrorGroupController = app.controller({
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
          providerIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionErrorGroupService.listSessionErrorGroups({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        types: ctx.input.types,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        providerIds: ctx.input.providerIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionErrorGroupPresenter);
    }),

  get: sessionErrorGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionErrorGroupId: v.string()
      })
    )
    .do(async ctx => sessionErrorGroupPresenter(ctx.sessionErrorGroup))
});
