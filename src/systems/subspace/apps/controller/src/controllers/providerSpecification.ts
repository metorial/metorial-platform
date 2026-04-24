import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerSpecificationService } from '@metorial-subspace/module-catalog';
import { providerSpecificationPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantOptionalApp } from './tenant';

export let providerSpecificationApp = tenantOptionalApp.use(async ctx => {
  let providerSpecificationId = ctx.body.providerSpecificationId;
  if (!providerSpecificationId) throw new Error('ProviderSpecification ID is required');

  let providerSpecification = await providerSpecificationService.getProviderSpecificationById({
    providerSpecificationId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerSpecification };
});

export let providerSpecificationController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerVersionIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          includeDeprecated: v.optional(v.boolean()),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerSpecificationService.listProviderSpecifications({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerVersionIds: ctx.input.providerVersionIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        includeDeprecated: ctx.input.includeDeprecated,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerSpecificationPresenter);
    }),

  get: providerSpecificationApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),

        providerSpecificationId: v.string()
      })
    )
    .do(async ctx => providerSpecificationPresenter(ctx.providerSpecification))
});
