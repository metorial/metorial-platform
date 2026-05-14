import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillVersionPresenter, skillVersionSnapshotPresenter } from '../presenters';
import { skillVersionService } from '../services';
import { app } from './_app';
import { skillApp } from './skill';
import { tenantApp } from './tenant';

export let skillVersionApp = tenantApp.use(async ctx => {
  let skillVersionId = ctx.body.skillVersionId;
  if (!skillVersionId) throw new Error('Skill version ID is required');

  let skillVersion = await skillVersionService.getSkillVersionById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillVersionId
  });

  return { skillVersion };
});

export let skillVersionController = app.controller({
  list: skillApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillVersionService.listSkillVersions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skillId: ctx.skill.id
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillVersionPresenter);
    }),

  get: skillVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillVersionId: v.string()
      })
    )
    .do(async ctx => skillVersionPresenter(ctx.skillVersion)),

  getSnapshot: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        skillVersionId: v.string()
      })
    )
    .do(async ctx =>
      skillVersionSnapshotPresenter(
        await skillVersionService.getSkillVersionSnapshot({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillId: ctx.skill.id,
          skillVersionId: ctx.input.skillVersionId
        })
      )
    )
});
