import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerAuthConfigService,
  providerAuthExportService
} from '@metorial-subspace/module-auth';
import { providerAuthExportPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let providerAuthExportApp = tenantApp.use(async ctx => {
  let providerAuthExportId = ctx.body.providerAuthExportId;
  if (!providerAuthExportId) throw new Error('ProviderAuthExport ID is required');

  let providerAuthExport = await providerAuthExportService.getProviderAuthExportById({
    providerAuthExportId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerAuthExport };
});

export let providerAuthExportController = app.controller({
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
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerAuthExportService.listProviderAuthExports({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerAuthCredentialsIds: ctx.input.providerAuthCredentialsIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthExportPresenter);
    }),

  get: providerAuthExportApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthExportId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerAuthExportPresenter(ctx.providerAuthExport)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        note: v.string(),
        metadata: v.optional(v.record(v.any())),

        ip: v.string(),
        ua: v.string(),

        providerAuthConfigId: v.string()
      })
    )
    .do(async ctx => {
      let providerAuthConfig = await providerAuthConfigService.getProviderAuthConfigById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerAuthConfigId: ctx.input.providerAuthConfigId
      });

      let providerAuthExport = await providerAuthExportService.createProviderAuthExport({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        authConfig: providerAuthConfig,

        input: {
          ip: ctx.input.ip,
          ua: ctx.input.ua,
          note: ctx.input.note,
          metadata: ctx.input.metadata
        }
      });

      return {
        ...providerAuthExportPresenter(providerAuthExport.authExport),
        value: providerAuthExport.decryptedConfigData
      };
    })
});
