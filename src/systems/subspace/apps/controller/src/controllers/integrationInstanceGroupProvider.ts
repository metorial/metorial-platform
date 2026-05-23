import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import {
  integrationInstanceGroupProviderService,
  integrationInstanceGroupService
} from '@metorial-subspace/module-integration';
import { integrationInstanceGroupProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let integrationInstanceGroupProviderApp = tenantApp.use(async ctx => {
  let integrationInstanceGroupProviderId = ctx.body.integrationInstanceGroupProviderId;
  if (!integrationInstanceGroupProviderId) {
    throw new Error('IntegrationInstanceGroupProvider ID is required');
  }

  let integrationInstanceGroupProvider =
    await integrationInstanceGroupProviderService.getIntegrationInstanceGroupProviderById({
      integrationInstanceGroupProviderId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { integrationInstanceGroupProvider };
});

export let integrationInstanceGroupProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          includeMagicMcpBackings: v.optional(v.boolean()),

          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),

          ids: v.optional(v.array(v.string())),
          integrationInstanceGroupIds: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          integrationInstanceIds: v.optional(v.array(v.string())),
          integrationInstanceProviderIds: v.optional(v.array(v.string())),
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
        await integrationInstanceGroupProviderService.listIntegrationInstanceGroupProviders({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          includeMagicMcpBackings: ctx.input.includeMagicMcpBackings,

          allowDeleted: ctx.input.allowDeleted,
          status: ctx.input.status,

          ids: ctx.input.ids,
          integrationInstanceGroupIds: ctx.input.integrationInstanceGroupIds,
          integrationIds: ctx.input.integrationIds,
          integrationInstanceIds: ctx.input.integrationInstanceIds,
          integrationInstanceProviderIds: ctx.input.integrationInstanceProviderIds,
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

      return Paginator.presentLight(list, integrationInstanceGroupProviderPresenter);
    }),

  get: integrationInstanceGroupProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceGroupProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      integrationInstanceGroupProviderPresenter(ctx.integrationInstanceGroupProvider)
    ),

  set: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        integrationInstanceGroupId: v.string(),
        integrationInstanceProviderId: v.string(),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let integrationInstanceGroup =
        await integrationInstanceGroupService.getIntegrationInstanceGroupById({
          integrationInstanceGroupId: ctx.input.integrationInstanceGroupId,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      let integrationInstanceGroupProvider =
        await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProvider({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          integrationInstanceGroup,
          input: {
            integrationInstanceProviderId: ctx.input.integrationInstanceProviderId,
            ...(ctx.input.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
              : {})
          }
        });

      return integrationInstanceGroupProviderPresenter(integrationInstanceGroupProvider);
    }),

  delete: integrationInstanceGroupProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceGroupProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integrationInstanceGroupProvider =
        await integrationInstanceGroupProviderService.archiveIntegrationInstanceGroupProvider({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          integrationInstanceGroupProvider: ctx.integrationInstanceGroupProvider
        });

      return integrationInstanceGroupProviderPresenter(integrationInstanceGroupProvider);
    })
});
