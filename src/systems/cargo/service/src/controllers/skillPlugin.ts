import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillPluginService } from '@metorial-cargo/module-skill';
import { skillPluginPresenter } from '../presenters';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { tenantApp } from './tenant';

export let skillPluginApp = tenantApp.use(async ctx => {
  let skillPluginId = ctx.body.skillPluginId;
  if (!skillPluginId) throw new Error('Skill plugin ID is required');

  let skillPlugin = await skillPluginService.getSkillPluginById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillPluginId
  });

  return { skillPlugin };
});

let metadataSchema = v.optional(v.nullable(v.record(v.any())));
let statusFilterSchema = v.optional(v.array(v.enumOf(['active', 'archived', 'deleted'])));
let skillPluginInput = {
  name: v.optional(v.string()),
  description: v.optional(v.nullable(v.string())),
  longDescription: v.optional(v.nullable(v.string())),
  category: v.optional(v.nullable(v.string())),
  slug: v.optional(v.string()),
  providerOverrides: metadataSchema,
  imageFileId: v.optional(v.nullable(v.string())),
  skillConfigurationId: v.optional(v.nullable(v.string()))
};

export let skillPluginController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        ...skillPluginInput,
        name: v.string()
      })
    )
    .do(async ctx =>
      skillPluginPresenter(
        await skillPluginService.createSkillPlugin({
          tenant: ctx.tenant,
          environment: ctx.environment,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            longDescription: ctx.input.longDescription,
            category: ctx.input.category,
            slug: ctx.input.slug,
            providerOverrides: ctx.input.providerOverrides,
            imageFileId: ctx.input.imageFileId,
            skillConfigurationId: ctx.input.skillConfigurationId
          }
        })
      )
    ),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillPluginIds: v.optional(v.array(v.string())),
          skillMarketplaceIds: v.optional(v.array(v.string())),
          skillMarketplacePluginIds: v.optional(v.array(v.string())),
          skillConfigurationIds: v.optional(v.array(v.string())),
          statuses: statusFilterSchema,
          category: v.optional(v.string()),
          slug: v.optional(v.string()),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillPluginService.listSkillPlugins({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillPluginIds,
        skillMarketplaceIds: ctx.input.skillMarketplaceIds,
        skillMarketplacePluginIds: ctx.input.skillMarketplacePluginIds,
        skillConfigurationIds: ctx.input.skillConfigurationIds,
        statuses: ctx.input.statuses,
        category: ctx.input.category,
        slug: ctx.input.slug,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list as any, skillPluginPresenter);
    }),

  get: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string()
      })
    )
    .do(async ctx => skillPluginPresenter(ctx.skillPlugin)),

  getEditorUrl: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        isReadOnly: v.optional(v.boolean())
      })
    )
    .do(
      async ctx =>
        await skillPluginService.getSkillPluginEditorUrl({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPlugin: ctx.skillPlugin,
          isReadOnly: ctx.input.isReadOnly
        })
    ),

  update: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        ...skillPluginInput
      })
    )
    .do(async ctx =>
      skillPluginPresenter(
        await skillPluginService.updateSkillPlugin({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPlugin: ctx.skillPlugin,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            longDescription: ctx.input.longDescription,
            category: ctx.input.category,
            slug: ctx.input.slug,
            providerOverrides: ctx.input.providerOverrides,
            imageFileId: ctx.input.imageFileId,
            skillConfigurationId: ctx.input.skillConfigurationId
          }
        })
      )
    ),

  archive: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string()
      })
    )
    .do(async ctx =>
      skillPluginPresenter(
        await skillPluginService.archiveSkillPlugin({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPlugin: ctx.skillPlugin
        })
      )
    )
});
