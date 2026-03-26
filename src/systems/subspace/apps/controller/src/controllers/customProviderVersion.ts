import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  customProviderService,
  customProviderVersionService
} from '@metorial-subspace/module-custom-provider';
import { actorService } from '@metorial-subspace/module-tenant';
import { customProviderVersionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { customProviderConfigValidator, customProviderFromValidator } from './customProvider';
import { tenantApp } from './tenant';

export let customProviderVersionApp = tenantApp.use(async ctx => {
  let customProviderVersionId = ctx.body.customProviderVersionId;
  if (!customProviderVersionId) throw new Error('CustomProviderVersion ID is required');

  let customProviderVersion = await customProviderVersionService.getCustomProviderVersionById({
    customProviderVersionId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { customProviderVersion };
});

export let customProviderVersionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(
            v.array(
              v.enumOf(['queued', 'deploying', 'deployment_succeeded', 'deployment_failed'])
            )
          ),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerVersionIds: v.optional(v.array(v.string())),
          customProviderIds: v.optional(v.array(v.string())),
          customProviderDeploymentIds: v.optional(v.array(v.string())),
          customProviderEnvironmentIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await customProviderVersionService.listCustomProviderVersions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerVersionIds: ctx.input.providerVersionIds,
        customProviderIds: ctx.input.customProviderIds,
        customProviderDeploymentIds: ctx.input.customProviderDeploymentIds,
        customProviderEnvironmentIds: ctx.input.customProviderEnvironmentIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, customProviderVersionPresenter);
    }),

  get: customProviderVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        customProviderVersionId: v.string()
      })
    )
    .do(async ctx => customProviderVersionPresenter(ctx.customProviderVersion)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.string(),

        customProviderId: v.string(),

        message: v.optional(v.string()),

        from: customProviderFromValidator,
        config: customProviderConfigValidator
      })
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      let customProvider = await customProviderService.getCustomProviderById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        customProviderId: ctx.input.customProviderId
      });

      let customProviderVersion =
        await customProviderVersionService.createCustomProviderVersion({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          actor,

          customProvider,

          input: {
            message: ctx.input.message,
            from: ctx.input.from as any,
            config: ctx.input.config as any
          }
        });

      return customProviderVersionPresenter(customProviderVersion);
    })
});
