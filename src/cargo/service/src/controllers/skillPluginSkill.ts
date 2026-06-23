import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillPluginSkillPresenter } from '../presenters';
import { skillPluginSkillService } from '@metorial-cargo/module-skill';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { skillPluginApp } from './skillPlugin';

let metadataSchema = v.optional(v.nullable(v.record(v.any())));
let statusFilterSchema = v.optional(v.array(v.enumOf(['active', 'archived', 'deleted'])));
let skillPluginSkillInput = {
  clientName: v.optional(v.nullable(v.string())),
  clientDescription: v.optional(v.nullable(v.string())),
  clientMetadata: metadataSchema,
  license: v.optional(v.nullable(v.string())),
  compatibility: v.optional(v.nullable(v.string())),
  skillConfigurationId: v.optional(v.nullable(v.string()))
};

export let skillPluginSkillController = app.controller({
  list: skillPluginApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillPluginId: v.string(),
          skillPluginSkillIds: v.optional(v.array(v.string())),
          skillIds: v.optional(v.array(v.string())),
          skillConfigurationIds: v.optional(v.array(v.string())),
          statuses: statusFilterSchema,
          pluginSkillSlug: v.optional(v.string()),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillPluginSkillService.listSkillPluginSkills({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skillPlugin: ctx.skillPlugin,
        ids: ctx.input.skillPluginSkillIds,
        skillIds: ctx.input.skillIds,
        skillConfigurationIds: ctx.input.skillConfigurationIds,
        statuses: ctx.input.statuses,
        pluginSkillSlug: ctx.input.pluginSkillSlug,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list as any, skillPluginSkillPresenter);
    }),

  get: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        skillPluginSkillId: v.string()
      })
    )
    .do(async ctx =>
      skillPluginSkillPresenter(
        await skillPluginSkillService.getSkillPluginSkillById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPlugin: ctx.skillPlugin,
          skillPluginSkillId: ctx.input.skillPluginSkillId
        })
      )
    ),

  add: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        skillId: v.string(),
        pluginSkillSlug: v.optional(v.string()),
        ...skillPluginSkillInput
      })
    )
    .do(async ctx =>
      skillPluginSkillPresenter(
        await skillPluginSkillService.addSkillPluginSkill({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPlugin: ctx.skillPlugin,
          input: {
            skillId: ctx.input.skillId,
            pluginSkillSlug: ctx.input.pluginSkillSlug,
            clientName: ctx.input.clientName,
            clientDescription: ctx.input.clientDescription,
            clientMetadata: ctx.input.clientMetadata,
            license: ctx.input.license,
            compatibility: ctx.input.compatibility,
            skillConfigurationId: ctx.input.skillConfigurationId
          }
        })
      )
    ),

  update: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        skillPluginSkillId: v.string(),
        ...skillPluginSkillInput
      })
    )
    .do(async ctx =>
      skillPluginSkillPresenter(
        await skillPluginSkillService.updateSkillPluginSkill({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPluginSkill: await skillPluginSkillService.getSkillPluginSkillById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            skillPlugin: ctx.skillPlugin,
            skillPluginSkillId: ctx.input.skillPluginSkillId
          }),
          input: {
            clientName: ctx.input.clientName,
            clientDescription: ctx.input.clientDescription,
            clientMetadata: ctx.input.clientMetadata,
            license: ctx.input.license,
            compatibility: ctx.input.compatibility,
            skillConfigurationId: ctx.input.skillConfigurationId
          }
        })
      )
    ),

  remove: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        skillPluginSkillId: v.string()
      })
    )
    .do(async ctx =>
      skillPluginSkillPresenter(
        await skillPluginSkillService.removeSkillPluginSkill({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPluginSkill: await skillPluginSkillService.getSkillPluginSkillById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            skillPlugin: ctx.skillPlugin,
            skillPluginSkillId: ctx.input.skillPluginSkillId
          })
        })
      )
    )
});
