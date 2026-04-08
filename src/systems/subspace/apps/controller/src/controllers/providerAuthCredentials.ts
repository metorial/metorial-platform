import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthCredentialsService } from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerAuthCredentialsPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let providerAuthCredentialsApp = tenantApp.use(async ctx => {
  let providerAuthCredentialsId = ctx.body.providerAuthCredentialsId;
  if (!providerAuthCredentialsId) throw new Error('ProviderAuthCredentials ID is required');

  let providerAuthCredentials =
    await providerAuthCredentialsService.getProviderAuthCredentialsById({
      providerAuthCredentialsId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { providerAuthCredentials };
});

export let providerAuthCredentialsController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),
          origin: v.optional(v.array(v.enumOf(['tenant_created', 'managed_backing']))),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerAuthMethodIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerAuthCredentialsService.listProviderAuthCredentials({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,
        origin: ctx.input.origin,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerAuthMethodIds: ctx.input.providerAuthMethodIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthCredentialsPresenter);
    }),

  get: providerAuthCredentialsApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthCredentialsId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => providerAuthCredentialsPresenter(ctx.providerAuthCredentials)),

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

        config: v.object({
          type: v.literal('oauth'),
          clientId: v.string(),
          clientSecret: v.string(),
          scopes: v.array(v.string())
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

      let providerAuthCredentials =
        await providerAuthCredentialsService.createProviderAuthCredentials({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,

          provider,

          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            isEphemeral: ctx.input.isEphemeral,
            config: ctx.input.config as any
          }
        });

      return providerAuthCredentialsPresenter(providerAuthCredentials);
    }),

  update: providerAuthCredentialsApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthCredentialsId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerAuthCredentials =
        await providerAuthCredentialsService.updateProviderAuthCredentials({
          providerAuthCredentials: ctx.providerAuthCredentials,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,

          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata
          }
        });

      return providerAuthCredentialsPresenter(providerAuthCredentials);
    }),

  delete: providerAuthCredentialsApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerAuthCredentialsId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let providerAuthCredentials =
        await providerAuthCredentialsService.archiveProviderAuthCredentials({
          providerAuthCredentials: ctx.providerAuthCredentials,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      return providerAuthCredentialsPresenter(providerAuthCredentials);
    })
});
