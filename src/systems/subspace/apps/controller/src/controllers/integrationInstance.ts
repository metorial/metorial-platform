import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationInstanceService,
  integrationService
} from '@metorial-subspace/module-integration';
import { integrationInstancePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

let integrationInstanceProviderInputValidator = v.object({
  providerId: v.string(),
  providerConfigId: v.optional(v.nullable(v.string())),
  providerAuthConfigId: v.optional(v.nullable(v.string())),
  toolFilters: toolFiltersValidator,
  isOverrideToolFilter: v.optional(v.boolean())
});

export let integrationInstanceApp = tenantApp.use(async ctx => {
  let integrationInstanceId = ctx.body.integrationInstanceId;
  if (!integrationInstanceId) throw new Error('IntegrationInstance ID is required');

  let integrationInstance = await integrationInstanceService.getIntegrationInstanceById({
    integrationInstanceId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { integrationInstance };
});

export let integrationInstanceController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['draft', 'active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),
          identityCredentialIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await integrationInstanceService.listIntegrationInstances({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        integrationIds: ctx.input.integrationIds,
        providerIds: ctx.input.providerIds,
        integrationProviderIds: ctx.input.integrationProviderIds,
        identityIds: ctx.input.identityIds,
        identityCredentialIds: ctx.input.identityCredentialIds,
        actorIds: ctx.input.actorIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, integrationInstancePresenter);
    }),

  get: integrationInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => integrationInstancePresenter(ctx.integrationInstance)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        integrationId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any())),
        identityActorId: v.optional(v.nullable(v.string())),
        identityId: v.optional(v.nullable(v.string())),
        providers: v.optional(v.array(integrationInstanceProviderInputValidator))
      })
    )
    .do(async ctx => {
      let integration = await integrationService.getIntegrationById({
        integrationId: ctx.input.integrationId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let integrationInstance = await integrationInstanceService.createIntegrationInstance({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integration,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          identityActorId: ctx.input.identityActorId,
          identityId: ctx.input.identityId,
          providers: ctx.input.providers?.map(provider => ({
            providerId: provider.providerId,
            providerConfigId: provider.providerConfigId,
            providerAuthConfigId: provider.providerAuthConfigId ?? undefined,
            isOverrideToolFilter: provider.isOverrideToolFilter,
            ...(provider.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(provider.toolFilters) }
              : {})
          }))
        }
      });

      return integrationInstancePresenter(integrationInstance);
    }),

  update: integrationInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        identityActorId: v.optional(v.nullable(v.string())),
        identityId: v.optional(v.nullable(v.string())),
        providers: v.optional(v.array(integrationInstanceProviderInputValidator))
      })
    )
    .do(async ctx => {
      let integrationInstance = await integrationInstanceService.updateIntegrationInstance({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integrationInstance: ctx.integrationInstance,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          identityActorId: ctx.input.identityActorId,
          identityId: ctx.input.identityId,
          providers: ctx.input.providers?.map(provider => ({
            providerId: provider.providerId,
            providerConfigId: provider.providerConfigId,
            providerAuthConfigId: provider.providerAuthConfigId ?? undefined,
            isOverrideToolFilter: provider.isOverrideToolFilter,
            ...(provider.toolFilters !== undefined
              ? { toolFilters: normalizeToolFilters(provider.toolFilters) }
              : {})
          }))
        }
      });

      return integrationInstancePresenter(integrationInstance);
    }),

  delete: integrationInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationInstanceId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integrationInstance = await integrationInstanceService.archiveIntegrationInstance({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integrationInstance: ctx.integrationInstance
      });

      return integrationInstancePresenter(integrationInstance);
    })
});
