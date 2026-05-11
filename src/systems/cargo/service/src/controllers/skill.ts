import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillPresenter } from '../presenters';
import { skillService, skillTemplateService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let skillApp = tenantApp.use(async ctx => {
  let skillId = ctx.body.skillId;
  if (!skillId) throw new Error('Skill ID is required');

  let skill = await skillService.getSkillById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillId
  });

  return { skill };
});

export let skillController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.optional(v.string()),
        storeId: v.optional(v.string()),
        parentSkillId: v.optional(v.string()),
        parentSkillTemplateId: v.optional(v.string()),
        name: v.string()
      })
    )
    .do(async ctx => {
      let parentSkill = ctx.input.parentSkillId
        ? await skillService.getSkillById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            skillId: ctx.input.parentSkillId
          })
        : undefined;
      let parentSkillTemplate = ctx.input.parentSkillTemplateId
        ? await skillTemplateService.getSkillTemplateById({
            skillTemplateId: ctx.input.parentSkillTemplateId
          })
        : undefined;

      let skill = await skillService.createSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        parentSkill,
        parentSkillTemplate,
        input: {
          id: ctx.input.skillId,
          storeId: ctx.input.storeId,
          name: ctx.input.name
        }
      });

      return skillPresenter(skill);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillService.listSkills({
        tenant: ctx.tenant,
        environment: ctx.environment
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillPresenter);
    }),

  get: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string()
      })
    )
    .do(async ctx => skillPresenter(ctx.skill)),

  update: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        name: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let skill = await skillService.updateSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skill: ctx.skill,
        input: {
          name: ctx.input.name
        }
      });

      return skillPresenter(skill);
    }),

  delete: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string()
      })
    )
    .do(async ctx => {
      let skill = await skillService.deleteSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skill: ctx.skill
      });

      return skillPresenter(skill);
    })
});
