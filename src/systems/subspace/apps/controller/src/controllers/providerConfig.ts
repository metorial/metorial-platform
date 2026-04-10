import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import {
  providerConfigPresenter,
  providerConfigSchemaPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { deploymentValidator, resolveDeployment } from './providerResourceValidators';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let providerConfigApp = tenantApp.use(async ctx => {
  let providerConfigId = ctx.body.providerConfigId;
  if (!providerConfigId) throw new Error('ProviderConfig ID is required');

  let providerConfig = await providerConfigService.getProviderConfigById({
    providerConfigId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerConfig };
});

export let providerConfigController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerSpecificationIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigVaultIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),
          identityCredentialIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerConfigService.listProviderConfigs({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerSpecificationIds: ctx.input.providerSpecificationIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigVaultIds: ctx.input.providerConfigVaultIds,
        actorIds: ctx.input.actorIds,
        identityIds: ctx.input.identityIds,
        identityCredentialIds: ctx.input.identityCredentialIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerConfigPresenter);
    }),

  getConfigSchema: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerId: v.optional(v.string()),
        providerConfigId: v.optional(v.string()),
        providerVersionId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let ts = { tenant: ctx.tenant, environment: ctx.environment, solution: ctx.solution };
      let provider = ctx.input.providerId
        ? await providerService.getProviderById({
            ...ts,
            providerId: ctx.input.providerId
          })
        : undefined;
      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            ...ts,
            providerDeploymentId: ctx.input.providerDeploymentId
          })
        : undefined;
      let providerConfig = ctx.input.providerConfigId
        ? await providerConfigService.getProviderConfigById({
            ...ts,
            providerConfigId: ctx.input.providerConfigId
          })
        : undefined;
      let providerVersion = ctx.input.providerVersionId
        ? await providerVersionService.getProviderVersionById({
            ...ts,
            providerVersionId: ctx.input.providerVersionId
          })
        : undefined;

      let config = await providerConfigService.getProviderConfigSchema({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        providerDeployment,
        providerConfig,
        providerVersion
      });

      return providerConfigSchemaPresenter(config);
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        ids: v.array(v.string()),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let providerConfigs = await providerConfigService.getManyProviderConfigsByIds({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        ids: ctx.input.ids,
        allowDeleted: ctx.input.allowDeleted
      });

      return providerConfigs.map(providerConfigPresenter);
    }),

  get: providerConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerConfigId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerConfigPresenter(ctx.providerConfig)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        isEphemeral: v.optional(v.boolean()),

        providerId: v.string(),
        providerDeployment: v.optional(deploymentValidator),
        toolFilters: toolFiltersValidator,

        config: v.union([
          v.object({
            type: v.literal('inline'),
            data: v.record(v.any())
          }),
          v.object({
            type: v.literal('vault'),
            providerConfigVaultId: v.string()
          })
        ])
      })
    )
    .do(async ctx => {
      let provider = await providerService.getProviderById({
        providerId: ctx.input.providerId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let providerDeployment = await resolveDeployment(
        { tenant: ctx.tenant, solution: ctx.solution, environment: ctx.environment },
        ctx.input.providerDeployment
      );

      let providerConfig = await providerConfigService.createProviderConfig({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        providerDeployment: providerDeployment?.deployment,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          isEphemeral: ctx.input.isEphemeral,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters),

          config:
            ctx.input.config.type === 'vault'
              ? {
                  type: 'vault',
                  vault: await providerConfigVaultService.getProviderConfigVaultById({
                    providerConfigVaultId: ctx.input.config.providerConfigVaultId,
                    tenant: ctx.tenant,
                    environment: ctx.environment,
                    solution: ctx.solution
                  })
                }
              : {
                  type: 'inline',
                  data: ctx.input.config.data
                }
        }
      });

      return providerConfigPresenter(providerConfig);
    }),

  update: providerConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerConfigId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let providerConfig = await providerConfigService.updateProviderConfig({
        providerConfig: ctx.providerConfig,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters as any)
        }
      });

      return providerConfigPresenter(providerConfig);
    }),

  delete: providerConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerConfigId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let providerConfig = await providerConfigService.archiveProviderConfig({
        providerConfig: ctx.providerConfig,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return providerConfigPresenter(providerConfig);
    })
});
