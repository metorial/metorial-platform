import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMarketplaceService } from '@metorial-cargo/module-skill';
import { skillMarketplacePresenter } from '../presenters';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { tenantApp } from './tenant';

export let skillMarketplaceApp = tenantApp.use(async ctx => {
  let skillMarketplaceId = ctx.body.skillMarketplaceId;
  if (!skillMarketplaceId) throw new Error('Skill marketplace ID is required');

  let skillMarketplace = await skillMarketplaceService.getSkillMarketplaceById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillMarketplaceId
  });

  return { skillMarketplace };
});

let metadataSchema = v.optional(v.nullable(v.record(v.any())));
let statusFilterSchema = v.optional(v.array(v.enumOf(['active', 'archived', 'deleted'])));
let skillMarketplaceInput = {
  name: v.optional(v.string()),
  description: v.optional(v.nullable(v.string())),
  slug: v.optional(v.string()),
  providerOverrides: metadataSchema,
  imageFileId: v.optional(v.nullable(v.string())),
  skillConfigurationId: v.optional(v.nullable(v.string()))
};

export let skillMarketplaceController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        ...skillMarketplaceInput,
        name: v.string()
      })
    )
    .do(async ctx =>
      skillMarketplacePresenter(
        await skillMarketplaceService.createSkillMarketplace({
          tenant: ctx.tenant,
          environment: ctx.environment,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
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
          skillMarketplaceIds: v.optional(v.array(v.string())),
          skillConfigurationIds: v.optional(v.array(v.string())),
          statuses: statusFilterSchema,
          slug: v.optional(v.string()),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillMarketplaceService.listSkillMarketplaces({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillMarketplaceIds,
        skillConfigurationIds: ctx.input.skillConfigurationIds,
        statuses: ctx.input.statuses,
        slug: ctx.input.slug,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list as any, skillMarketplacePresenter);
    }),

  get: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string()
      })
    )
    .do(async ctx => skillMarketplacePresenter(ctx.skillMarketplace)),

  getEditorUrl: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        isReadOnly: v.optional(v.boolean())
      })
    )
    .do(
      async ctx =>
        await skillMarketplaceService.getSkillMarketplaceEditorUrl({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplace: ctx.skillMarketplace,
          isReadOnly: ctx.input.isReadOnly
        })
    ),

  update: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        ...skillMarketplaceInput
      })
    )
    .do(async ctx =>
      skillMarketplacePresenter(
        await skillMarketplaceService.updateSkillMarketplace({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplace: ctx.skillMarketplace,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            slug: ctx.input.slug,
            providerOverrides: ctx.input.providerOverrides,
            imageFileId: ctx.input.imageFileId,
            skillConfigurationId: ctx.input.skillConfigurationId
          }
        })
      )
    ),

  archive: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string()
      })
    )
    .do(async ctx =>
      skillMarketplacePresenter(
        await skillMarketplaceService.archiveSkillMarketplace({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplace: ctx.skillMarketplace
        })
      )
    )
});
