import { v } from '@lowerdeck/validation';
import { skillForkSyncService } from '@metorial-cargo/module-skill';
import { skillForkSyncPresenter } from '../presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let skillForkSyncController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        forkSkillId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      skillForkSyncPresenter(
        await skillForkSyncService.createSkillForkSync({
          tenant: ctx.tenant,
          environment: ctx.environment,
          forkSkillId: ctx.input.forkSkillId,
          actorId: ctx.input.actorId
        })
      )
    ),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillForkSyncId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      skillForkSyncPresenter(
        await skillForkSyncService.getSkillForkSyncById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillForkSyncId: ctx.input.skillForkSyncId,
          actorId: ctx.input.actorId
        })
      )
    )
});
