import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { customProviderDeploymentService } from '@metorial-subspace/module-custom-provider';
import { customProviderDeploymentPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let customProviderDeploymentApp = tenantApp.use(async ctx => {
  let customProviderDeploymentId = ctx.body.customProviderDeploymentId;
  if (!customProviderDeploymentId) throw new Error('CustomProviderDeployment ID is required');

  let customProviderDeployment =
    await customProviderDeploymentService.getCustomProviderDeploymentById({
      customProviderDeploymentId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution
    });

  return { customProviderDeployment };
});

export let customProviderDeploymentController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(
            v.array(v.enumOf(['queued', 'deploying', 'succeeded', 'failed']))
          ),

          ids: v.optional(v.array(v.string())),
          customProviderIds: v.optional(v.array(v.string())),
          customProviderVersionIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await customProviderDeploymentService.listCustomProviderDeployments({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,

        ids: ctx.input.ids,
        customProviderIds: ctx.input.customProviderIds,
        customProviderVersionIds: ctx.input.customProviderVersionIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, customProviderDeploymentPresenter);
    }),

  get: customProviderDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        customProviderDeploymentId: v.string()
      })
    )
    .do(async ctx => customProviderDeploymentPresenter(ctx.customProviderDeployment)),

  getLogs: customProviderDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        customProviderDeploymentId: v.string()
      })
    )
    .do(
      async ctx =>
        await customProviderDeploymentService.getLogs({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          customProviderDeployment: ctx.customProviderDeployment
        })
    )
});
