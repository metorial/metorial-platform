import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { skillItemService } from '@metorial-subspace/module-skills';
import { skillItemPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

let createSkillItemValidator = v.union([
  v.object({
    tenantId: v.string(),
    environmentId: v.string(),
    skillId: v.string(),
    type: v.literal('integration'),
    integrationId: v.string()
  }),
  v.object({
    tenantId: v.string(),
    environmentId: v.string(),
    skillId: v.string(),
    type: v.literal('provider'),
    providerId: v.string()
  })
]);

export let skillItemApp = tenantApp.use(async ctx => {
  let skillItemId = ctx.body.skillItemId;
  if (!skillItemId) throw new Error('SkillItem ID is required');

  let skillItem = await skillItemService.getSkillItemById({
    skillItemId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { skillItem };
});

export let skillItemController = app.controller({
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
          skillIds: v.optional(v.array(v.string())),
          type: v.optional(v.array(v.enumOf(['integration', 'provider']))),
          integrationIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillItemService.listSkillItems({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        ids: ctx.input.ids,
        skillIds: ctx.input.skillIds,
        type: ctx.input.type,
        integrationIds: ctx.input.integrationIds,
        providerIds: ctx.input.providerIds,
        createdAt: ctx.input.createdAt
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, skillItemPresenter);
    }),

  get: skillItemApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillItemId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => skillItemPresenter(ctx.skillItem)),

  create: tenantApp
    .handler()
    .input(createSkillItemValidator)
    .do(async ctx => {
      let input =
        ctx.input.type === 'integration'
          ? {
              skillId: ctx.input.skillId,
              type: 'integration' as const,
              integrationId: ctx.input.integrationId
            }
          : {
              skillId: ctx.input.skillId,
              type: 'provider' as const,
              providerId: ctx.input.providerId
            };

      let skillItem = await skillItemService.createSkillItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input
      });

      return skillItemPresenter(skillItem);
    }),

  delete: skillItemApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillItemId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let skillItem = await skillItemService.archiveSkillItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillItem: ctx.skillItem
      });

      return skillItemPresenter(skillItem);
    })
});
