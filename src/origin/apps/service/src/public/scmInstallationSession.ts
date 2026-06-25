import { createHono } from '@lowerdeck/hono';
import { db } from '../db';
import { installationSessionHtml } from '../lib/templates/installationSession';
import { scmAuthService, scmBackendService, scmInstallationSessionService } from '../services';

export let scmInstallationSessionPublicController = createHono()
  .get('/:sessionId', async c => {
    let sessionId = c.req.param('sessionId');

    let session = await scmInstallationSessionService.getInstallationSessionPublic({
      sessionId
    });

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

    let authUrl = await scmAuthService.getAuthorizationUrl({
      tenant,
      actor,
      provider:
        backend.type === 'github' || backend.type === 'github_enterprise'
          ? 'github'
          : 'gitlab',
      backendId: backend.id,
      redirectUrl: '',
      state: session.state
    });

    return c.redirect(authUrl);
  });
