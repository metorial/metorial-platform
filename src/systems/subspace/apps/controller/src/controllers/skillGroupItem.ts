import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillGroupItemService } from '@metorial-subspace/module-skills';
import { skillGroupItemPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let skillGroupItemApp = tenantApp.use(async ctx => {
  let skillGroupItemId = ctx.body.skillGroupItemId;
  if (!skillGroupItemId) throw new Error('SkillGroupItem ID is required');

  let skillGroupItem = await skillGroupItemService.getSkillGroupItemById({
    skillGroupItemId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { skillGroupItem };
});

export let skillGroupItemController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          skillGroupIds: v.optional(v.array(v.string())),
          skillIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillGroupItemService.listSkillGroupItems({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        ids: ctx.input.ids,
        skillGroupIds: ctx.input.skillGroupIds,
        skillIds: ctx.input.skillIds,
        createdAt: ctx.input.createdAt
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, skillGroupItemPresenter);
    }),

  get: skillGroupItemApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillGroupItemId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => skillGroupItemPresenter(ctx.skillGroupItem)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillGroupId: v.string(),
        skillId: v.string()
      })
    )
    .do(async ctx => {
      let skillGroupItem = await skillGroupItemService.createSkillGroupItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          skillGroupId: ctx.input.skillGroupId,
          skillId: ctx.input.skillId
        }
      });

      return skillGroupItemPresenter(skillGroupItem);
    }),

  delete: skillGroupItemApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillGroupItemId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let skillGroupItem = await skillGroupItemService.archiveSkillGroupItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillGroupItem: ctx.skillGroupItem
      });

      return skillGroupItemPresenter(skillGroupItem);
    })
});
