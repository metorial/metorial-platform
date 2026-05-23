import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import type { Environment, Solution, Tenant } from '@metorial-subspace/db';
import {
  providerAuthConfigService,
  providerAuthImportService
} from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import {
  providerAuthConfigImportSchemaPresenter,
  providerAuthImportPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let providerAuthImportApp = tenantApp.use(async ctx => {
  let providerAuthImportId = ctx.body.providerAuthImportId;
  if (!providerAuthImportId) throw new Error('ProviderAuthImport ID is required');

  let providerAuthImport = await providerAuthImportService.getProviderAuthImportById({
    providerAuthImportId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerAuthImport };
});

let getCreateData = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  providerId?: string;
  providerDeploymentId?: string;
  providerAuthConfigId?: string;
}) => {
  let provider = d.providerId
    ? await providerService.getProviderById({
        providerId: d.providerId,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment
      })
    : undefined;
  let providerDeployment = d.providerDeploymentId
    ? await providerDeploymentService.getProviderDeploymentById({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        providerDeploymentId: d.providerDeploymentId
      })
    : undefined;
  let providerAuthConfig = d.providerAuthConfigId
    ? await providerAuthConfigService.getProviderAuthConfigById({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        providerAuthConfigId: d.providerAuthConfigId
      })
    : undefined;

  return { provider, providerDeployment, providerAuthConfig };
};

export let providerAuthImportController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerAuthCredentialsIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerAuthImportService.listProviderAuthImports({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerAuthCredentialsIds: ctx.input.providerAuthCredentialsIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthImportPresenter);
    }),

  getSchema: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),
        providerAuthMethodId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let { provider, providerDeployment, providerAuthConfig } = await getCreateData({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerId: ctx.input.providerId,
        providerDeploymentId: ctx.input.providerDeploymentId,
        providerAuthConfigId: ctx.input.providerAuthConfigId
      });

      let schema = await providerAuthImportService.getProviderAuthImportSchema({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        providerDeployment,
        providerAuthConfig,

        input: {
          authMethodId: ctx.input.providerAuthMethodId
        }
      });

      return providerAuthConfigImportSchemaPresenter(schema);
    }),

  get: providerAuthImportApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthImportId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerAuthImportPresenter(ctx.providerAuthImport)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),
        providerAuthMethodId: v.optional(v.string()),

        note: v.string(),
        metadata: v.optional(v.record(v.any())),

        ip: v.string(),
        ua: v.string(),

        config: v.record(v.any())
      })
    )
    .do(async ctx => {
      let { provider, providerDeployment, providerAuthConfig } = await getCreateData({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerId: ctx.input.providerId,
        providerDeploymentId: ctx.input.providerDeploymentId,
        providerAuthConfigId: ctx.input.providerAuthConfigId
      });

      let providerAuthImport = await providerAuthImportService.createProviderAuthImport({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        providerDeployment,
        providerAuthConfig,

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          ip: ctx.input.ip,
          ua: ctx.input.ua,
          note: ctx.input.note,
          metadata: ctx.input.metadata,

          config: ctx.input.config
        }
      });

      return providerAuthImportPresenter(providerAuthImport);
    })
});
