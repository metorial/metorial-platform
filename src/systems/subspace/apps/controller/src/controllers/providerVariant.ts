import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { providerVariantService } from '@metorial-subspace/module-catalog';
import { providerVariantPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantOptionalApp } from './tenant';

export let providerVariantApp = tenantOptionalApp.use(async ctx => {
  let providerVariantId = ctx.body.providerVariantId;
  if (!providerVariantId) throw new Error('ProviderVariant ID is required');

  let providerVariant = await providerVariantService.getProviderVariantById({
    providerVariantId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerVariant };
});

export let providerVariantController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),
          includeDeprecated: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerVariantService.listProviderVariants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        includeDeprecated: ctx.input.includeDeprecated
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerVariantPresenter);
    }),

  get: providerVariantApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),
        providerVariantId: v.string()
      })
    )
    .do(async ctx => providerVariantPresenter(ctx.providerVariant))
});
