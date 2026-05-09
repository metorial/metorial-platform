import { v } from '@lowerdeck/validation';
import { environmentPresenter, tenantPresenter } from '../presenters';
import { environmentService, tenantService } from '../services';
import { app } from './_app';

export let tenantWithoutEnvironmentApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId) throw new Error('Tenant ID is required');

  let tenant = await tenantService.getTenantById({ id: tenantId });

  return { tenant };
});

export let tenantApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let environmentId = ctx.body.environmentId;
  if (!environmentId) throw new Error('Environment ID is required');

  let environment = await environmentService.getEnvironmentById({
    tenant: ctx.tenant,
    id: environmentId
  });

  return { environment };
});

export let tenantController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.upsertTenant({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });

      return tenantPresenter(tenant);
    }),

  get: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ctx => {
      let environments = await environmentService.listEnvironments({
        tenant: ctx.tenant
      });

      return {
        ...tenantPresenter(ctx.tenant),
        environments: environments.map(environmentPresenter)
      };
    })
});
