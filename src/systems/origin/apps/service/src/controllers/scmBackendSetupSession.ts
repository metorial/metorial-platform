import { v } from '@lowerdeck/validation';
import { presentScmBackendSetupSession } from '../presenters/scmBackendSetupSession';
import { scmInstallationSessionService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmBackendSetupSessionApp = tenantApp.use(async ctx => {
  let sessionId = ctx.body.sessionId;
  if (!sessionId) throw new Error('Session ID is required');

  let session = await scmInstallationSessionService.getBackendSetupSession({
    sessionId,
    tenant: ctx.tenant
  });

  return { session };
});

export let scmBackendSetupSessionController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        type: v.enumOf(['github_enterprise', 'gitlab_selfhosted']),
        parentInstallationSessionId: v.optional(v.string()),
        redirectUrl: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let parentInstallationSession = ctx.input.parentInstallationSessionId
        ? await scmInstallationSessionService.getInstallationSession({
            sessionId: ctx.input.parentInstallationSessionId,
            tenant: ctx.tenant
          })
        : undefined;

      let session = await scmInstallationSessionService.createBackendSetupSession({
        tenant: ctx.tenant,
        type: ctx.input.type,
        parentInstallationSession,
        redirectUrl: ctx.input.redirectUrl
      });

      return presentScmBackendSetupSession(session);
    }),

  get: scmBackendSetupSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        sessionId: v.string()
      })
    )
    .do(async ctx => {
      return presentScmBackendSetupSession(ctx.session);
    })
});
