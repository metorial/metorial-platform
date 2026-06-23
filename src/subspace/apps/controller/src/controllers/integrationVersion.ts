import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { integrationVersionService } from '@metorial-subspace/module-integration';
import { integrationVersionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let integrationVersionApp = tenantApp.use(async ctx => {
  let integrationVersionId = ctx.body.integrationVersionId;
  if (!integrationVersionId) throw new Error('IntegrationVersion ID is required');

  let integrationVersion = await integrationVersionService.getIntegrationVersionById({
    integrationVersionId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { integrationVersion };
});

export let integrationVersionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await integrationVersionService.listIntegrationVersions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        integrationIds: ctx.input.integrationIds,
        integrationProviderIds: ctx.input.integrationProviderIds,

        createdAt: ctx.input.createdAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, integrationVersionPresenter);
    }),

  get: integrationVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationVersionId: v.string()
      })
    )
    .do(async ctx => integrationVersionPresenter(ctx.integrationVersion))
});
