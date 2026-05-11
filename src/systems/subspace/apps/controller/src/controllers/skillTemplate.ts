import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillTemplateService } from '@metorial-subspace/module-skills';
import { skillTemplatePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let addSkillTemplateItemValidator = v.object({
  tenantId: v.string(),
  environmentId: v.string(),
  skillTemplateId: v.string(),
  skillItemId: v.string()
});

export let skillTemplateApp = tenantApp.use(async ctx => {
  let skillTemplateId = ctx.body.skillTemplateId;
  if (!skillTemplateId) throw new Error('SkillTemplate ID is required');

  let skillTemplate = await skillTemplateService.getSkillTemplateById({
    skillTemplateId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { skillTemplate };
});

export let skillTemplateController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),
          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),
          owner: v.optional(v.array(v.enumOf(['system', 'tenant']))),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillTemplateService.listSkillTemplates({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        search: ctx.input.search,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        owner: ctx.input.owner,
        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        integrationIds: ctx.input.integrationIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, skillTemplatePresenter);
    }),

  get: skillTemplateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => skillTemplatePresenter(ctx.skillTemplate)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let skillTemplate = await skillTemplateService.createSkillTemplate({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata
        }
      });

      return skillTemplatePresenter(skillTemplate);
    }),

  update: skillTemplateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any())))
      })
    )
    .do(async ctx => {
      let skillTemplate = await skillTemplateService.updateSkillTemplate({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplate: ctx.skillTemplate,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata
        }
      });

      return skillTemplatePresenter(skillTemplate);
    }),

  delete: skillTemplateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let skillTemplate = await skillTemplateService.archiveSkillTemplate({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplate: ctx.skillTemplate
      });

      return skillTemplatePresenter(skillTemplate);
    }),

  addItem: tenantApp
    .handler()
    .input(addSkillTemplateItemValidator)
    .do(async ctx => {
      let skillTemplate = await skillTemplateService.addSkillTemplateItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplateId: ctx.input.skillTemplateId,
        input: {
          skillItemId: ctx.input.skillItemId
        }
      });

      return skillTemplatePresenter(skillTemplate);
    }),

  removeItem: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string(),
        skillTemplateItemId: v.string()
      })
    )
    .do(async ctx => {
      let skillTemplate = await skillTemplateService.removeSkillTemplateItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplateId: ctx.input.skillTemplateId,
        skillTemplateItemId: ctx.input.skillTemplateItemId
      });

      return skillTemplatePresenter(skillTemplate);
    })
});
