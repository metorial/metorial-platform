import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerVersionService } from '@metorial-subspace/module-catalog';
import { providerVersionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantOptionalApp } from './tenant';

export let providerVersionApp = tenantOptionalApp.use(async ctx => {
  let providerVersionId = ctx.body.providerVersionId;
  if (!providerVersionId) throw new Error('ProviderVersion ID is required');

  let providerVersion = await providerVersionService.getProviderVersionById({
    providerVersionId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerVersion };
});

export let providerVersionController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          includeDeprecated: v.optional(v.boolean()),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerVersionService.listProviderVersions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        includeDeprecated: ctx.input.includeDeprecated,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerVersionPresenter);
    }),

  get: providerVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),

        providerVersionId: v.string()
      })
    )
    .do(async ctx => providerVersionPresenter(ctx.providerVersion))
});
