import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import {
  integrationProviderService,
  integrationService
} from '@metorial-subspace/module-integration';
import { integrationProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let integrationProviderApp = tenantApp.use(async ctx => {
  let integrationProviderId = ctx.body.integrationProviderId;
  if (!integrationProviderId) throw new Error('IntegrationProvider ID is required');

  let integrationProvider = await integrationProviderService.getIntegrationProviderById({
    integrationProviderId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { integrationProvider };
});

export let integrationProviderController = app.controller({
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
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerAuthMethodIds: v.optional(v.array(v.string())),
          providerAuthCredentialsIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await integrationProviderService.listIntegrationProviders({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,
        includeMagicMcpBackings: ctx.input.includeMagicMcpBackings,

        allowDeleted: ctx.input.allowDeleted,
        status: ctx.input.status,

        ids: ctx.input.ids,
        integrationIds: ctx.input.integrationIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerAuthMethodIds: ctx.input.providerAuthMethodIds,
        providerAuthCredentialsIds: ctx.input.providerAuthCredentialsIds,
        providerConfigIds: ctx.input.providerConfigIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, integrationProviderPresenter);
    }),

  get: integrationProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => integrationProviderPresenter(ctx.integrationProvider)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        integrationId: v.string(),
        providerId: v.string(),
        providerDeploymentId: v.string(),
        providerAuthMethodId: v.optional(v.nullable(v.string())),
        providerAuthCredentialsId: v.optional(v.nullable(v.string())),
        providerConfigId: v.optional(v.nullable(v.string())),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let integration = await integrationService.getIntegrationById({
        integrationId: ctx.input.integrationId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let integrationProvider = await integrationProviderService.createIntegrationProvider({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integration,
        input: {
          providerId: ctx.input.providerId,
          providerDeploymentId: ctx.input.providerDeploymentId,
          providerAuthMethodId: ctx.input.providerAuthMethodId,
          providerAuthCredentialsId: ctx.input.providerAuthCredentialsId,
          providerConfigId: ctx.input.providerConfigId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters)
        }
      });

      return integrationProviderPresenter(integrationProvider);
    }),

  update: integrationProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        providerDeploymentId: v.optional(v.string()),
        providerAuthMethodId: v.optional(v.nullable(v.string())),
        providerAuthCredentialsId: v.optional(v.nullable(v.string())),
        providerConfigId: v.optional(v.nullable(v.string())),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let integrationProvider = await integrationProviderService.updateIntegrationProvider({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integrationProvider: ctx.integrationProvider,
        input: {
          providerDeploymentId: ctx.input.providerDeploymentId,
          providerAuthMethodId: ctx.input.providerAuthMethodId,
          providerAuthCredentialsId: ctx.input.providerAuthCredentialsId,
          providerConfigId: ctx.input.providerConfigId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters)
        }
      });

      return integrationProviderPresenter(integrationProvider);
    }),

  delete: integrationProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integrationProvider = await integrationProviderService.archiveIntegrationProvider({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integrationProvider: ctx.integrationProvider
      });

      return integrationProviderPresenter(integrationProvider);
    })
});
