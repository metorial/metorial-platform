import { v } from '@mtsrc/validation';
import { tenantPresenter } from '../../presenters';
import { tenantService } from '../../services';
import { app } from './_app';

export let tenantApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId) throw new Error('tenantId is required');

  let tenant = await tenantService.getTenantById({ id: tenantId });

  return { tenant };
});

export let tenantOptionalApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId) return { tenant: undefined };

  let tenant = await tenantService.getTenantById({ id: tenantId });
  return { tenant };
});

export let tenantController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string(),
        logRetentionInDays: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.upsertTenant({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier,
          logRetentionInDays: ctx.input.logRetentionInDays
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
