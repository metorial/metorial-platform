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
        ref: v.string(),

        skewBoundSeconds: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
        backfillMaxAgeDays: v.optional(
          v.nullable(v.number({ modifiers: [v.positive(), v.integer()] }))
        ),
        recordRetentionDays: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
        contentRetentionDays: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.upsertTenant({
        input: {
          ref: ctx.input.ref,
          skewBoundSeconds: ctx.input.skewBoundSeconds,
          backfillMaxAgeDays: ctx.input.backfillMaxAgeDays,
          recordRetentionDays: ctx.input.recordRetentionDays,
          contentRetentionDays: ctx.input.contentRetentionDays
        }
      });

      return tenantPresenter(tenant);
    }),

  eraseRecords: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ctx => {
      await tenantService.eraseRecords({ tenant: ctx.tenant });

      return { tenantId: ctx.tenant.id, erasing: true };
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
