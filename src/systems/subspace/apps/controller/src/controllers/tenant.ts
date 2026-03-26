import { v } from '@lowerdeck/validation';
import { tenantService } from '@metorial-subspace/module-tenant';
import { tenantPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';

export let tenantWithoutEnvironmentApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId) throw new Error('Tenant ID is required');

  let tenant = await tenantService.getTenantById({ id: tenantId });

  return { tenant };
});

export let tenantApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  let environmentId = ctx.body.environmentId;
  if (!tenantId || !environmentId)
    throw new Error('Tenant ID and Environment ID are required');

  let { tenant, environment } = await tenantService.getTenantAndEnvironmentById({
    tenantId,
    environmentId
  });

  return { tenant, environment };
});

export let tenantOptionalApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  let environmentId = ctx.body.environmentId;
  if (!tenantId || !environmentId) {
    return { tenant: undefined, environment: undefined };
  }

  let { tenant, environment } = await tenantService.getTenantAndEnvironmentById({
    tenantId,
    environmentId
  });

  return { tenant, environment };
});

export let tenantController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string(),

        environments: v.array(
          v.object({
            name: v.string(),
            identifier: v.string(),
            type: v.enumOf(['development', 'production'])
          })
        )
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.upsertTenant({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier,
          environments: ctx.input.environments as any
        }
      });
      return tenantPresenter(tenant);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string()
      })
    )
    .do(async ctx => tenantPresenter(ctx.tenant))
});
