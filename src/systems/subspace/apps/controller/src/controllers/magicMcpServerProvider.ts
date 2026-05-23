import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { magicMcpServerProviderService } from '@metorial-subspace/module-integration';
import { magicMcpServerProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let magicMcpServerProviderApp = tenantApp.use(async ctx => {
  let magicMcpServerProviderId = ctx.body.magicMcpServerProviderId;
  if (!magicMcpServerProviderId) throw new Error('MagicMcpServerProvider ID is required');

  let magicMcpServerProvider =
    await magicMcpServerProviderService.getMagicMcpServerProviderById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      magicMcpServerProviderId,
      allowDeleted: ctx.body.allowDeleted
    });

  return { magicMcpServerProvider };
});

export let magicMcpServerProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['pending', 'active', 'archived', 'deleted']))),
          ids: v.optional(v.array(v.string())),
          magicMcpServerBackingIds: v.optional(v.array(v.string())),
          integrationProviderIds: v.optional(v.array(v.string())),
          integrationInstanceProviderIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await magicMcpServerProviderService.listMagicMcpServerProviders({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        allowDeleted: ctx.input.allowDeleted,
        status: ctx.input.status,
        ids: ctx.input.ids,
        magicMcpServerBackingIds: ctx.input.magicMcpServerBackingIds,
        integrationProviderIds: ctx.input.integrationProviderIds,
        integrationInstanceProviderIds: ctx.input.integrationInstanceProviderIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, magicMcpServerProviderPresenter);
    }),

  get: magicMcpServerProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => magicMcpServerProviderPresenter(ctx.magicMcpServerProvider)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerBackingId: v.string(),
        providerId: v.string(),
        providerDeploymentId: v.optional(v.string()),
        providerConfigId: v.optional(v.nullable(v.string())),
        providerAuthConfigId: v.optional(v.nullable(v.string())),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let row = await magicMcpServerProviderService.createMagicMcpServerProvider({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerBackingId: ctx.input.magicMcpServerBackingId,
        input: {
          providerId: ctx.input.providerId,
          providerDeploymentId: ctx.input.providerDeploymentId,
          providerConfigId: ctx.input.providerConfigId,
          providerAuthConfigId: ctx.input.providerAuthConfigId,
          ...(ctx.input.toolFilters !== undefined
            ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
            : {})
        }
      });

      return magicMcpServerProviderPresenter(row);
    }),

  update: magicMcpServerProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),
        providerDeploymentId: v.optional(v.string()),
        providerConfigId: v.optional(v.nullable(v.string())),
        providerAuthConfigId: v.optional(v.nullable(v.string())),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let row = await magicMcpServerProviderService.updateMagicMcpServerProvider({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerProviderId: ctx.input.magicMcpServerProviderId,
        input: {
          providerDeploymentId: ctx.input.providerDeploymentId,
          providerConfigId: ctx.input.providerConfigId,
          providerAuthConfigId: ctx.input.providerAuthConfigId,
          ...(ctx.input.toolFilters !== undefined
            ? { toolFilters: normalizeToolFilters(ctx.input.toolFilters) }
            : {})
        }
      });

      return magicMcpServerProviderPresenter(row);
    }),

  delete: magicMcpServerProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        magicMcpServerProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let row = await magicMcpServerProviderService.archiveMagicMcpServerProvider({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        magicMcpServerProviderId: ctx.input.magicMcpServerProviderId
      });

      return magicMcpServerProviderPresenter(row);
    })
});
