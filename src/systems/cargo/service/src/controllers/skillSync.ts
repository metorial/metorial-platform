import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillSyncService } from '@metorial-cargo/module-skill';
import { skillSyncPresenter } from '../presenters';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { tenantApp } from './tenant';

export let skillSyncApp = tenantApp.use(async ctx => {
  let skillSyncId = ctx.body.skillSyncId;
  if (!skillSyncId) throw new Error('Skill sync ID is required');

  let skillSync = await skillSyncService.getSkillSyncById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillSyncId
  });

  return { skillSync };
});

let statusFilterSchema = v.optional(
  v.array(v.enumOf(['pending', 'completed', 'failed', 'processing', 'canceled']))
);

export let skillSyncController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillSyncIds: v.optional(v.array(v.string())),
          skillMarketplaceIds: v.optional(v.array(v.string())),
          skillPluginIds: v.optional(v.array(v.string())),
          statuses: statusFilterSchema,
          createdAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillSyncService.listSkillSyncs({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillSyncIds,
        skillMarketplaceIds: ctx.input.skillMarketplaceIds,
        skillPluginIds: ctx.input.skillPluginIds,
        statuses: ctx.input.statuses,
        createdAt: ctx.input.createdAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillSyncPresenter);
    }),

  get: skillSyncApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillSyncId: v.string()
      })
    )
    .do(async ctx => skillSyncPresenter(ctx.skillSync))
});
