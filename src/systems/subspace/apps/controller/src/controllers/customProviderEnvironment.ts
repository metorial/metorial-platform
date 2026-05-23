import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { customProviderEnvironmentService } from '@metorial-subspace/module-custom-provider';
import { customProviderEnvironmentPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let customProviderEnvironmentApp = tenantApp.use(async ctx => {
  let customProviderEnvironmentId = ctx.body.customProviderEnvironmentId;
  if (!customProviderEnvironmentId)
    throw new Error('CustomProviderEnvironment ID is required');

  let customProviderEnvironment =
    await customProviderEnvironmentService.getCustomProviderEnvironmentById({
      customProviderEnvironmentId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution
    });

  return { customProviderEnvironment };
});

export let customProviderEnvironmentController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          customProviderIds: v.optional(v.array(v.string())),
          customProviderVersionIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await customProviderEnvironmentService.listCustomProviderEnvironments({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        customProviderIds: ctx.input.customProviderIds,
        customProviderVersionIds: ctx.input.customProviderVersionIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, customProviderEnvironmentPresenter);
    }),

  get: customProviderEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        customProviderEnvironmentId: v.string()
      })
    )
    .do(async ctx => customProviderEnvironmentPresenter(ctx.customProviderEnvironment))
});
