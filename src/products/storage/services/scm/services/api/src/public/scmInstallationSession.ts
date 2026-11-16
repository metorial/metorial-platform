import { createHono } from '@lowerdeck/hono';
import { db } from '../db';
import { installationSessionHtml } from '../lib/templates/installationSession';
import { scmResultHtml } from '../lib/templates/scmResult';
import { presentScmInstallationSession } from '../presenters/scmInstallationSession';
import { scmAuthService, scmBackendService, scmInstallationSessionService } from '../services';

export let scmInstallationSessionPublicController = createHono()
  .get('/:sessionId', async c => {
    let sessionId = c.req.param('sessionId');

    let session = await scmInstallationSessionService.getInstallationSessionPublic({
      sessionId,
      allowExpired: true
    });

    if (session.status === 'succeeded') {
      return c.html(scmResultHtml({ kind: 'succeeded', redirectUrl: session.redirectUrl }));
    }
    if (session.expiresAt <= new Date()) {
      return c.html(scmResultHtml({ kind: 'expired', redirectUrl: session.redirectUrl }));
    }
    if (session.status === 'pending_approval') {
      return c.html(
        scmResultHtml({
          kind: 'pending_approval',
          sessionId: session.id,
          redirectUrl: session.redirectUrl,
          accountName: session.githubPendingAccountLogin,
          canRecheck: Boolean(
            session.githubPendingAccountLogin && session.githubPendingAccountType
          )
        })
      );
    }

    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: session.tenantOid } });
    let backends = await scmInstallationSessionService.getAvailableBackends({ tenant });

    return c.html(
      installationSessionHtml({
        sessionId: session.id,
        backends: backends.map(b => ({
          id: b.id,
          type: b.type,
          name: b.name,
          description: b.description,
          isDefault: b.isDefault
        }))
      })
    );
  })
  .post('/:sessionId/recheck', async c => {
    let session = await scmAuthService.recheckGitHubInstallationSession({
      sessionId: c.req.param('sessionId')
    });
    return c.json(presentScmInstallationSession(session));
  })
  .get('/:sessionId/select-backend/:backendId', async c => {
    let sessionId = c.req.param('sessionId');
    let backendId = c.req.param('backendId');

    let session = await scmInstallationSessionService.getInstallationSessionPublic({
      sessionId
    });

    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: session.tenantOid } });
    let actor = await db.actor.findUniqueOrThrow({ where: { oid: session.ownerActorOid } });
    let backend = await scmBackendService.getScmBackendById({
      backendId,
      tenant
    });
    await db.scmInstallationSession.update({
      where: { oid: session.oid },
      data: { selectedBackendOid: backend.oid }
    });

    if (backend.type === 'github' || backend.type === 'github_enterprise') {
      await scmAuthService.prepareGitHubInstallationRequest({
        sessionId: session.id,
        backend
      });
    }

    let authUrl = await scmAuthService.getAuthorizationUrl({
      tenant,
      actor,
      provider:
        backend.type === 'github' || backend.type === 'github_enterprise'
          ? 'github'
          : backend.type === 'gitlab' || backend.type === 'gitlab_selfhosted'
            ? 'gitlab'
            : 'bitbucket',
      backendId: backend.id,
      redirectUrl: '',
      state: session.state
    });

    return c.redirect(authUrl);
  });
