import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillParticipantService } from '@metorial-cargo/module-skill';
import { skillParticipantPresenter } from '../presenters';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
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
          skillParticipantIds: v.optional(v.array(v.string())),
          skillId: v.string(),
          actorIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillParticipantService.listSkillParticipants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillParticipantIds,
        skillId: ctx.input.skillId,
        actorIds: ctx.input.actorIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
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
