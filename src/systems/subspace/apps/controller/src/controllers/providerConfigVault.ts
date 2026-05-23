import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { providerService } from '@metorial-subspace/module-catalog';
import {
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { providerConfigVaultPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let providerConfigVaultApp = tenantApp.use(async ctx => {
  let providerConfigVaultId = ctx.body.providerConfigVaultId;
  if (!providerConfigVaultId) throw new Error('ProviderConfigVault ID is required');

  let providerConfigVault = await providerConfigVaultService.getProviderConfigVaultById({
    providerConfigVaultId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { providerConfigVault };
});

export let providerConfigVaultController = app.controller({
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
          providerConfigIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerConfigVaultService.listProviderConfigVaults({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerConfigVaultPresenter);
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
      let providerConfigVaults =
        await providerConfigVaultService.getManyProviderConfigVaultsByIds({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          ids: ctx.input.ids,
          allowDeleted: ctx.input.allowDeleted
        });

      return providerConfigVaults.map(providerConfigVaultPresenter);
    }),

  get: providerConfigVaultApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerConfigVaultId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerConfigVaultPresenter(ctx.providerConfigVault)),

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

        providerId: v.string(),
        providerDeploymentId: v.optional(v.string()),

        config: v.object({
          type: v.literal('inline'),
          data: v.record(v.any())
        })
      })
    )
    .do(async ctx => {
      let provider = await providerService.getProviderById({
        providerId: ctx.input.providerId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            providerDeploymentId: ctx.input.providerDeploymentId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          })
        : undefined;

      let providerConfigVault = await providerConfigVaultService.createProviderConfigVault({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        providerDeployment,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,

          config: {
            type: 'inline',
            data: ctx.input.config.data
          }
        }
      });

      return providerConfigVaultPresenter(providerConfigVault);
    }),

  update: providerConfigVaultApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerConfigVaultId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerConfigVault = await providerConfigVaultService.updateProviderConfigVault({
        providerConfigVault: ctx.providerConfigVault,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata
        }
      });

      return providerConfigVaultPresenter(providerConfigVault);
    }),

  delete: providerConfigVaultApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerConfigVaultId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let providerConfigVault = await providerConfigVaultService.archiveProviderConfigVault({
        providerConfigVault: ctx.providerConfigVault,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return providerConfigVaultPresenter(providerConfigVault);
    })
});
