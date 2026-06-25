import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationInstanceProviderService,
  integrationInstanceService
} from '@metorial-subspace/module-integration';
import { integrationInstanceProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let integrationInstanceProviderApp = tenantApp.use(async ctx => {
  let integrationInstanceProviderId = ctx.body.integrationInstanceProviderId;
  if (!integrationInstanceProviderId)
    throw new Error('IntegrationInstanceProvider ID is required');

  let integrationInstanceProvider =
    await integrationInstanceProviderService.getIntegrationInstanceProviderById({
      integrationInstanceProviderId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { integrationInstanceProvider };
});

export let integrationInstanceProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),
          includeMagicMcpBackings: v.optional(v.boolean()),

          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),

          ids: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          integrationInstanceIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator =
        await integrationInstanceProviderService.listIntegrationInstanceProviders({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,

          search: ctx.input.search,
          includeMagicMcpBackings: ctx.input.includeMagicMcpBackings,

          allowDeleted: ctx.input.allowDeleted,
          status: ctx.input.status,

          ids: ctx.input.ids,
          integrationIds: ctx.input.integrationIds,
          integrationInstanceIds: ctx.input.integrationInstanceIds,
          providerIds: ctx.input.providerIds,
          integrationProviderIds: ctx.input.integrationProviderIds,
          providerDeploymentIds: ctx.input.providerDeploymentIds,
          providerConfigIds: ctx.input.providerConfigIds,
          providerAuthConfigIds: ctx.input.providerAuthConfigIds,
          sessionTemplateIds: ctx.input.sessionTemplateIds,

          createdAt: ctx.input.createdAt,
          updatedAt: ctx.input.updatedAt
        });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, integrationInstanceProviderPresenter);
    }),

  get: integrationInstanceProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => integrationInstanceProviderPresenter(ctx.integrationInstanceProvider)),

  set: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        integrationInstanceId: v.string(),
        providerId: v.string(),
        providerConfigId: v.optional(v.nullable(v.string())),
        providerAuthConfigId: v.optional(v.nullable(v.string())),
        toolFilters: toolFiltersValidator,
        isOverrideToolFilter: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integrationInstance = await integrationInstanceService.getIntegrationInstanceById({
        integrationInstanceId: ctx.input.integrationInstanceId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let integrationInstanceProvider =
        await integrationInstanceProviderService.setIntegrationInstanceProvider({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          integrationInstance,
          input: {
            providerId: ctx.input.providerId,
            providerConfigId: ctx.input.providerConfigId,
            providerAuthConfigId: ctx.input.providerAuthConfigId ?? undefined,
            isOverrideToolFilter: ctx.input.isOverrideToolFilter,
            ...(ctx.input.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
              : {})
          }
        });

      return integrationInstanceProviderPresenter(integrationInstanceProvider);
    })
});
