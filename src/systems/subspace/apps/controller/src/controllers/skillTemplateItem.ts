import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillTemplateItemService } from '@metorial-subspace/module-skills';
import { skillTemplateItemPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { skillTemplateApp } from './skillTemplate';
import { tenantApp } from './tenant';

let createSkillTemplateItemValidator = v.union([
  v.object({
    tenantId: v.string(),
    environmentId: v.string(),
    skillTemplateId: v.string(),
    type: v.literal('provider'),
    providerId: v.string()
  }),
  v.object({
    tenantId: v.string(),
    environmentId: v.string(),
    skillTemplateId: v.string(),
    type: v.literal('integration'),
    integrationId: v.string()
  })
]);

export let skillTemplateItemApp = skillTemplateApp.use(async ctx => {
  let skillTemplateItemId = ctx.body.skillTemplateItemId;
  if (!skillTemplateItemId) throw new Error('SkillTemplateItem ID is required');

  let skillTemplateItem = await skillTemplateItemService.getSkillTemplateItem({
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    skillTemplateId: ctx.skillTemplate.id,
    skillTemplateItemId
  });

  return { skillTemplateItem };
});

export let skillTemplateItemController = app.controller({
  list: skillTemplateApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillTemplateId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillTemplateItemService.listSkillTemplateItems({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplateId: ctx.skillTemplate.id
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, skillTemplateItemPresenter);
    }),

  get: skillTemplateItemApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string(),
        skillTemplateItemId: v.string()
      })
    )
    .do(async ctx => skillTemplateItemPresenter(ctx.skillTemplateItem)),

  create: tenantApp
    .handler()
    .input(createSkillTemplateItemValidator)
    .do(async ctx => {
      let input =
        ctx.input.type === 'integration'
          ? {
              type: 'integration' as const,
              integrationId: ctx.input.integrationId
            }
          : {
              type: 'provider' as const,
              providerId: ctx.input.providerId
            };

      let skillTemplateItem = await skillTemplateItemService.createSkillTemplateItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplateId: ctx.input.skillTemplateId,
        input
      });

      return skillTemplateItemPresenter(skillTemplateItem);
    }),

  delete: skillTemplateItemApp
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
      let skillTemplateItem = await skillTemplateItemService.deleteSkillTemplateItem({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplateId: ctx.skillTemplate.id,
        skillTemplateItemId: ctx.skillTemplateItem.id
      });

      return skillTemplateItemPresenter(skillTemplateItem);
    })
});
