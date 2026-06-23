import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { scmPushService } from '@metorial-subspace/module-custom-provider';
import { scmPushPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let scmPushApp = tenantApp.use(async ctx => {
  let scmPushId = ctx.body.scmPushId;
  if (!scmPushId) throw new Error('ScmPush ID is required');

  let scmPush = await scmPushService.getScmPushById({
    scmPushId,
    tenant: ctx.tenant,
    solution: ctx.solution,
    environment: ctx.environment
  });

  return { scmPush };
});

export let scmPushController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          scmRepoIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await scmPushService.listScmPushes({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        scmRepoIds: ctx.input.scmRepoIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, scmPushPresenter);
    }),

  get: scmPushApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmPushId: v.string()
      })
    )
    .do(async ctx => scmPushPresenter(ctx.scmPush))
});
