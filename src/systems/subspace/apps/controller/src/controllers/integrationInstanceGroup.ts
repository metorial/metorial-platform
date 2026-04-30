import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { integrationInstanceGroupService } from '@metorial-subspace/module-integration';
import {
  integrationInstanceGroupPresenter,
  sessionTemplatePresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

let integrationInstanceGroupProviderInputValidator = v.object({
  integrationInstanceProviderId: v.string(),
  toolFilters: toolFiltersValidator
});

export let integrationInstanceGroupApp = tenantApp.use(async ctx => {
  let integrationInstanceGroupId = ctx.body.integrationInstanceGroupId;
  if (!integrationInstanceGroupId) {
    throw new Error('IntegrationInstanceGroup ID is required');
  }

  let integrationInstanceGroup =
    await integrationInstanceGroupService.getIntegrationInstanceGroupById({
      integrationInstanceGroupId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { integrationInstanceGroup };
});

export let integrationInstanceGroupController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['draft', 'active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
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
        await integrationInstanceGroupService.listIntegrationInstanceGroups({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,

          status: ctx.input.status,
          allowDeleted: ctx.input.allowDeleted,

          ids: ctx.input.ids,
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

      return Paginator.presentLight(list, integrationInstanceGroupPresenter);
    }),

  get: integrationInstanceGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceGroupId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => integrationInstanceGroupPresenter(ctx.integrationInstanceGroup)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any())),
        providers: v.optional(v.array(integrationInstanceGroupProviderInputValidator))
      })
    )
    .do(async ctx => {
      let integrationInstanceGroup =
        await integrationInstanceGroupService.createIntegrationInstanceGroup({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            privateMetadata: ctx.input.privateMetadata,
            providers: ctx.input.providers?.map(provider => ({
              integrationInstanceProviderId: provider.integrationInstanceProviderId,
              ...(provider.toolFilters !== undefined
                ? { toolFilters: normalizeToolFilters(provider.toolFilters) }
                : {})
            }))
          }
        });

      return integrationInstanceGroupPresenter(integrationInstanceGroup);
    }),

  update: integrationInstanceGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceGroupId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        providers: v.optional(v.array(integrationInstanceGroupProviderInputValidator))
      })
    )
    .do(async ctx => {
      let integrationInstanceGroup =
        await integrationInstanceGroupService.updateIntegrationInstanceGroup({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          integrationInstanceGroup: ctx.integrationInstanceGroup,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            privateMetadata: ctx.input.privateMetadata,
            providers: ctx.input.providers?.map(provider => ({
              integrationInstanceProviderId: provider.integrationInstanceProviderId,
              ...(provider.toolFilters !== undefined
                ? { toolFilters: normalizeToolFilters(provider.toolFilters) }
                : {})
            }))
          }
        });

      return integrationInstanceGroupPresenter(integrationInstanceGroup);
    }),

  createSessionTemplate: integrationInstanceGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceGroupId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let sessionTemplate =
        await integrationInstanceGroupService.createSessionTemplateForIntegrationInstanceGroup(
          {
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            integrationInstanceGroup: ctx.integrationInstanceGroup,
            input: {
              name: ctx.input.name,
              description: ctx.input.description,
              metadata: ctx.input.metadata,
              privateMetadata: ctx.input.privateMetadata
            }
          }
        );

      return sessionTemplatePresenter(sessionTemplate);
    }),

  delete: integrationInstanceGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceGroupId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integrationInstanceGroup =
        await integrationInstanceGroupService.archiveIntegrationInstanceGroup({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          integrationInstanceGroup: ctx.integrationInstanceGroup
        });

      return integrationInstanceGroupPresenter(integrationInstanceGroup);
    })
});
