import { v } from '@lowerdeck/validation';
import { tenantPresenter } from '../presenters';
import { tenantService } from '../services';
import { app } from './_app';

export let tenantApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId) throw new Error('Tenant ID is required');

  let tenant = await tenantService.getTenantById({ id: tenantId });

  return { tenant };
});

export let tenantController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.optional(v.string()), // Ignored, but kept for backwards compatibility
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.upsertTenant({
        input: {
          identifier: ctx.input.identifier
        }
      });
      return tenantPresenter(tenant);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ctx => tenantPresenter(ctx.tenant))
});
