import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMarketplacePluginPresenter } from '../presenters';
import { skillMarketplacePluginService } from '@metorial-cargo/module-skill';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { skillMarketplaceApp } from './skillMarketplace';

let statusFilterSchema = v.optional(v.array(v.enumOf(['active', 'archived', 'deleted'])));

export let skillMarketplacePluginController = app.controller({
  list: skillMarketplaceApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillMarketplaceId: v.string(),
          skillMarketplacePluginIds: v.optional(v.array(v.string())),
          skillPluginIds: v.optional(v.array(v.string())),
          skillConfigurationIds: v.optional(v.array(v.string())),
          statuses: statusFilterSchema,
          pluginSlug: v.optional(v.string()),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillMarketplacePluginService.listSkillMarketplacePlugins({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skillMarketplace: ctx.skillMarketplace,
        ids: ctx.input.skillMarketplacePluginIds,
        skillPluginIds: ctx.input.skillPluginIds,
        skillConfigurationIds: ctx.input.skillConfigurationIds,
        statuses: ctx.input.statuses,
        pluginSlug: ctx.input.pluginSlug,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list as any, skillMarketplacePluginPresenter);
    }),

  get: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        skillMarketplacePluginId: v.string()
      })
    )
    .do(async ctx =>
      skillMarketplacePluginPresenter(
        await skillMarketplacePluginService.getSkillMarketplacePluginById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplace: ctx.skillMarketplace,
          skillMarketplacePluginId: ctx.input.skillMarketplacePluginId
        })
      )
    ),

  add: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        skillPluginId: v.string(),
        pluginSlug: v.optional(v.string()),
        skillConfigurationId: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx =>
      skillMarketplacePluginPresenter(
        await skillMarketplacePluginService.addSkillMarketplacePlugin({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplace: ctx.skillMarketplace,
          input: {
            skillPluginId: ctx.input.skillPluginId,
            pluginSlug: ctx.input.pluginSlug,
            skillConfigurationId: ctx.input.skillConfigurationId
          }
        })
      )
    ),

  remove: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        skillMarketplacePluginId: v.string()
      })
    )
    .do(async ctx =>
      skillMarketplacePluginPresenter(
        await skillMarketplacePluginService.removeSkillMarketplacePlugin({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplacePlugin:
            await skillMarketplacePluginService.getSkillMarketplacePluginById({
              tenant: ctx.tenant,
              environment: ctx.environment,
              skillMarketplace: ctx.skillMarketplace,
              skillMarketplacePluginId: ctx.input.skillMarketplacePluginId
            })
        })
      )
    )
});
