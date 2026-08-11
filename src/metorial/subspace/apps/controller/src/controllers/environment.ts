import { v } from '@lowerdeck/validation';
import { environmentService } from '@metorial-subspace/module-tenant';
import { environmentPresenter } from '@metorial-subspace/presenters';
import { tenantWithoutEnvironmentApp } from './tenant';

export let environmentApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let environmentId = ctx.body.environmentId;
  if (!environmentId) throw new Error('Environment ID is required');

  let environment = await environmentService.getEnvironmentById({
    tenant: ctx.tenant,
    id: environmentId
  });

  return { environment };
});

export let environmentController = tenantWithoutEnvironmentApp.controller({
  upsert: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        identifier: v.string(),
        type: v.enumOf(['development', 'production']),
        resourceGroupId: v.string(),
        resourceGroupIdentifier: v.string()
      })
    )
    .do(async ctx => {
      let environment = await environmentService.upsertEnvironment({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier,
          type: ctx.input.type,
          resourceGroupId: ctx.input.resourceGroupId,
          resourceGroupIdentifier: ctx.input.resourceGroupIdentifier
        }
      });
      return environmentPresenter(environment);
    }),

  get: environmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string()
      })
    )
    .do(async ctx => environmentPresenter(ctx.environment))
});
