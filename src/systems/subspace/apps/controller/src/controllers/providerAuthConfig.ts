import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import {
  providerAuthConfigPresenter,
  providerAuthConfigSchemaPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { deploymentValidator, resolveDeployment } from './providerResourceValidators';
import { normalizeToolFilters, toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let providerAuthConfigApp = tenantApp.use(async ctx => {
  let providerAuthConfigId = ctx.body.providerAuthConfigId;
  if (!providerAuthConfigId) throw new Error('ProviderAuthConfig ID is required');

  let providerAuthConfig = await providerAuthConfigService.getProviderAuthConfigById({
    providerAuthConfigId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerAuthConfig };
});

export let providerAuthConfigController = app.controller({
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
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerAuthCredentialsIds: v.optional(v.array(v.string())),
          providerAuthMethodIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          identityIds: v.optional(v.array(v.string())),
          identityCredentialIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerAuthConfigService.listProviderAuthConfigs({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerAuthCredentialsIds: ctx.input.providerAuthCredentialsIds,
        providerAuthMethodIds: ctx.input.providerAuthMethodIds,
        actorIds: ctx.input.actorIds,
        identityIds: ctx.input.identityIds,
        identityCredentialIds: ctx.input.identityCredentialIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthConfigPresenter);
    }),

  get: providerAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthConfigId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerAuthConfigPresenter(ctx.providerAuthConfig)),

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

        ip: v.string(),
        ua: v.string(),

        providerId: v.string(),
        providerDeployment: v.optional(deploymentValidator),
        providerAuthMethodId: v.string(),
        toolFilters: toolFiltersValidator,

        config: v.record(v.any())
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

      let providerAuthConfig = await providerAuthConfigService.createProviderAuthConfig({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        source: 'manual',

        provider,
        providerDeployment: providerDeployment?.deployment,

        import: {
          ip: ctx.input.ip,
          ua: ctx.input.ua
        },

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          isEphemeral: ctx.input.isEphemeral,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters),
          config: ctx.input.config
        }
      });

      return providerAuthConfigPresenter(providerAuthConfig);
    }),

  getConfigSchema: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerId: v.optional(v.string()),

        providerAuthConfigId: v.optional(v.string()),
        providerVersionId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),

        authMethodId: v.optional(v.string())
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
      let providerAuthConfig = ctx.input.providerAuthConfigId
        ? await providerAuthConfigService.getProviderAuthConfigById({
            ...ts,
            providerAuthConfigId: ctx.input.providerAuthConfigId
          })
        : undefined;
      let providerVersion = ctx.input.providerVersionId
        ? await providerVersionService.getProviderVersionById({
            ...ts,
            providerVersionId: ctx.input.providerVersionId
          })
        : undefined;

      let config = await providerAuthConfigService.getProviderAuthConfigSchema({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        authMethodId: ctx.input.authMethodId,

        provider,
        providerDeployment,
        providerAuthConfig,
        providerVersion
      });

      return providerAuthConfigSchemaPresenter(config);
    }),

  update: providerAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthConfigId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        ip: v.string(),
        ua: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let providerAuthConfig = await providerAuthConfigService.updateProviderAuthConfig({
        providerAuthConfig: ctx.providerAuthConfig,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        import: {
          ip: ctx.input.ip,
          ua: ctx.input.ua
        },

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          toolFilters: normalizeToolFilters(ctx.input.toolFilters)
        }
      });

      return providerAuthConfigPresenter(providerAuthConfig);
    })
});
