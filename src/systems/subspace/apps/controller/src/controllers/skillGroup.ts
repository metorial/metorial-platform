import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillGroupService } from '@metorial-subspace/module-skills';
import { skillGroupPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let skillGroupApp = tenantApp.use(async ctx => {
  let skillGroupId = ctx.body.skillGroupId;
  if (!skillGroupId) throw new Error('SkillGroup ID is required');

  let skillGroup = await skillGroupService.getSkillGroupById({
    skillGroupId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { skillGroup };
});

export let skillGroupController = app.controller({
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

          ids: v.optional(v.array(v.string())),
          skillIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillGroupService.listSkillGroups({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        search: ctx.input.search,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        ids: ctx.input.ids,
        skillIds: ctx.input.skillIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, skillGroupPresenter);
    }),

  get: skillGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillGroupId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => skillGroupPresenter(ctx.skillGroup)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        skillIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let skillGroup = await skillGroupService.createSkillGroup({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          skillIds: ctx.input.skillIds
        }
      });

      return skillGroupPresenter(skillGroup);
    }),

  update: skillGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillGroupId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        skillIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let skillGroup = await skillGroupService.updateSkillGroup({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillGroup: ctx.skillGroup,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          skillIds: ctx.input.skillIds
        }
      });

      return skillGroupPresenter(skillGroup);
    }),

  delete: skillGroupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillGroupId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let skillGroup = await skillGroupService.archiveSkillGroup({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillGroup: ctx.skillGroup
      });

      return skillGroupPresenter(skillGroup);
    })
});
