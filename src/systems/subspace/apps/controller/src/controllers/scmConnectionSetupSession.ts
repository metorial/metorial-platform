import { v } from '@lowerdeck/validation';
import {
  scmConnectionSetupSessionPresenter,
  scmConnectionSetupSessionService
} from '@metorial-subspace/module-custom-provider';
import { actorService } from '@metorial-subspace/module-tenant';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmConnectionSetupSessionApp = tenantApp.use(async ctx => {
  let scmConnectionSetupSessionId = ctx.body.scmConnectionSetupSessionId;
  if (!scmConnectionSetupSessionId)
    throw new Error('ScmConnectionSetupSession ID is required');

  let scmConnectionSetupSession =
    await scmConnectionSetupSessionService.getScmConnectionSetupSessionById({
      scmConnectionSetupSessionId,
      tenant: ctx.tenant
    });

  return { scmConnectionSetupSession };
});

export let scmConnectionSetupSessionController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        actorId: v.string(),
        redirectUrl: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      let record = await scmConnectionSetupSessionService.createScmConnectionSetupSession({
        tenant: ctx.tenant,
        actor,
        redirectUrl: ctx.input.redirectUrl
      });

      return scmConnectionSetupSessionPresenter(record);
    }),

  get: scmConnectionSetupSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        scmConnectionSetupSessionId: v.string()
      })
    )
    .do(async ctx => scmConnectionSetupSessionPresenter(ctx.scmConnectionSetupSession))
});
