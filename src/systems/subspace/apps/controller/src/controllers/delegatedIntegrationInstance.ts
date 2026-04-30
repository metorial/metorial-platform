import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { delegatedIntegrationInstanceService } from '@metorial-subspace/module-integration';
import {
  delegatedIntegrationInstancePresenter,
  sessionTemplatePresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

let delegatedIntegrationInstanceProviderInputValidator = v.object({
  integrationInstanceProviderId: v.string(),
  toolFilters: toolFiltersValidator
});

export let delegatedIntegrationInstanceApp = tenantApp.use(async ctx => {
  let delegatedIntegrationInstanceId = ctx.body.delegatedIntegrationInstanceId;
  if (!delegatedIntegrationInstanceId) {
    throw new Error('DelegatedIntegrationInstance ID is required');
  }

  let delegatedIntegrationInstance =
    await delegatedIntegrationInstanceService.getDelegatedIntegrationInstanceById({
      delegatedIntegrationInstanceId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { delegatedIntegrationInstance };
});

export let delegatedIntegrationInstanceController = app.controller({
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
        await delegatedIntegrationInstanceService.listDelegatedIntegrationInstances({
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

      return Paginator.presentLight(list, delegatedIntegrationInstancePresenter);
    }),

  get: delegatedIntegrationInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        delegatedIntegrationInstanceId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => delegatedIntegrationInstancePresenter(ctx.delegatedIntegrationInstance)),

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
        providers: v.optional(v.array(delegatedIntegrationInstanceProviderInputValidator))
      })
    )
    .do(async ctx => {
      let delegatedIntegrationInstance =
        await delegatedIntegrationInstanceService.createDelegatedIntegrationInstance({
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

      return delegatedIntegrationInstancePresenter(delegatedIntegrationInstance);
    }),

  update: delegatedIntegrationInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        delegatedIntegrationInstanceId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        providers: v.optional(v.array(delegatedIntegrationInstanceProviderInputValidator))
      })
    )
    .do(async ctx => {
      let delegatedIntegrationInstance =
        await delegatedIntegrationInstanceService.updateDelegatedIntegrationInstance({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          delegatedIntegrationInstance: ctx.delegatedIntegrationInstance,
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

      return delegatedIntegrationInstancePresenter(delegatedIntegrationInstance);
    }),

  createSessionTemplate: delegatedIntegrationInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        delegatedIntegrationInstanceId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let sessionTemplate =
        await delegatedIntegrationInstanceService.createSessionTemplateForDelegatedIntegrationInstance(
          {
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            delegatedIntegrationInstance: ctx.delegatedIntegrationInstance,
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

  delete: delegatedIntegrationInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        delegatedIntegrationInstanceId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let delegatedIntegrationInstance =
        await delegatedIntegrationInstanceService.archiveDelegatedIntegrationInstance({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          delegatedIntegrationInstance: ctx.delegatedIntegrationInstance
        });

      return delegatedIntegrationInstancePresenter(delegatedIntegrationInstance);
    })
});
