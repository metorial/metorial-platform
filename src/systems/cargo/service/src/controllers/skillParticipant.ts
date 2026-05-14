import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillParticipantPresenter } from '../presenters';
import { skillParticipantService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let skillParticipantApp = tenantApp.use(async ctx => {
  let skillParticipantId = ctx.body.skillParticipantId;
  if (!skillParticipantId) throw new Error('Skill participant ID is required');

  let skillParticipant = await skillParticipantService.getSkillParticipantById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillParticipantId
  });

  return { skillParticipant };
});

export let skillParticipantController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillParticipantService.listSkillParticipants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skillId: ctx.input.skillId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillParticipantPresenter);
    }),

  get: skillParticipantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillParticipantId: v.string()
      })
    )
    .do(async ctx => skillParticipantPresenter(ctx.skillParticipant))
});
