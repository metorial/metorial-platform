import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { integrationService } from '@metorial-subspace/module-integration';
import { integrationPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let integrationApp = tenantApp.use(async ctx => {
  let integrationId = ctx.body.integrationId;
  if (!integrationId) throw new Error('Integration ID is required');

  let integration = await integrationService.getIntegrationById({
    integrationId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { integration };
});

export let integrationController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await integrationService.listIntegrations({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        integrationProviderIds: ctx.input.integrationProviderIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, integrationPresenter);
    }),

  get: integrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => integrationPresenter(ctx.integration)),

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
        canAttachCustomToolFilters: v.optional(v.boolean()),
        canAttachCustomProviderConfig: v.optional(v.boolean()),
        canOverrideToolFilters: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integration = await integrationService.createIntegration({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          canAttachCustomToolFilters: ctx.input.canAttachCustomToolFilters,
          canAttachCustomProviderConfig: ctx.input.canAttachCustomProviderConfig,
          canOverrideToolFilters: ctx.input.canOverrideToolFilters
        }
      });

      return integrationPresenter(integration);
    }),

  update: integrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any()))),
        canAttachCustomToolFilters: v.optional(v.boolean()),
        canAttachCustomProviderConfig: v.optional(v.boolean()),
        canOverrideToolFilters: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integration = await integrationService.updateIntegration({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integration: ctx.integration,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          canAttachCustomToolFilters: ctx.input.canAttachCustomToolFilters,
          canAttachCustomProviderConfig: ctx.input.canAttachCustomProviderConfig,
          canOverrideToolFilters: ctx.input.canOverrideToolFilters
        }
      });

      return integrationPresenter(integration);
    }),

  delete: integrationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        integrationId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let integration = await integrationService.archiveIntegration({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        integration: ctx.integration
      });

      return integrationPresenter(integration);
    })
});
