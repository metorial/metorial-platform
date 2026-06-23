import { v } from '@lowerdeck/validation';
import { presentScmInstallationSession } from '../presenters/scmInstallationSession';
import { actorService, scmInstallationSessionService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmInstallationSessionApp = tenantApp.use(async ctx => {
  let sessionId = ctx.body.sessionId;
  if (!sessionId) throw new Error('Session ID is required');

  let session = await scmInstallationSessionService.getInstallationSession({
    sessionId,
    tenant: ctx.tenant
  });

  return { session };
});

export let scmInstallationSessionController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        actorId: v.string(),
        redirectUrl: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({ id: ctx.input.actorId });

      let session = await scmInstallationSessionService.createInstallationSession({
        tenant: ctx.tenant,
        actor,
        redirectUrl: ctx.input.redirectUrl
      });

      return presentScmInstallationSession(session);
    }),

  get: scmInstallationSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        sessionId: v.string()
      })
    )
    .do(async ctx => {
      return presentScmInstallationSession(ctx.session);
    })
});
