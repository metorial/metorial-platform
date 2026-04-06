import { createHono, useValidatedBody } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { db } from '../db';
import { backendSetupHtml } from '../lib/templates/backendSetup';
import { completeDashboardHtml } from '../lib/templates/completeDashboard';
import { scmBackendService, scmInstallationSessionService } from '../services';

export let scmBackendSetupPublicController = createHono()
  .get('/installation-session/:sessionId/setup-backend', async c => {
    let sessionId = c.req.param('sessionId');

    let session = await scmInstallationSessionService.getInstallationSessionPublic({
      sessionId
    });

    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: session.tenantOid } });

    let setupSession = await scmInstallationSessionService.createBackendSetupSession({
      tenant,
      type: 'github_enterprise',
      parentInstallationSession: session
    });

    return c.html(
      backendSetupHtml({
        sessionId: setupSession.id,
        installationSessionId: session.id
      })
    );
  })
  .get('/backend-setup/:sessionId', async c => {
    let sessionId = c.req.param('sessionId');

    let setupSession = await scmInstallationSessionService.getBackendSetupSessionPublic({
      sessionId
    });

    return c.html(
      backendSetupHtml({
        sessionId: setupSession.id,
        installationSessionId: setupSession.parentInstallationSession?.id
      })
    );
  })
  .post('/backend-setup/:sessionId/complete', async c => {
    let sessionId = c.req.param('sessionId');

    let body = await useValidatedBody(
      c,
      v.object({
        type: v.union([v.literal('github_enterprise'), v.literal('gitlab_selfhosted')]),
        name: v.string(),
        apiUrl: v.string(),
        clientId: v.string(),
        clientSecret: v.string(),
        appId: v.optional(v.string()),
        appSlug: v.optional(v.string()),
        appPrivateKey: v.optional(v.string())
      })
    );

    let setupSession = await scmInstallationSessionService.getBackendSetupSessionPublic({
      sessionId
    });

    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: setupSession.tenantOid } });

    // Extract base URL from apiUrl (remove path like /api/v3 or /api/v4)
    let baseUrl = new URL(body.apiUrl);
    baseUrl.pathname = '';
    let webUrl = baseUrl.toString().replace(/\/$/, ''); // Remove trailing slash

    // Add the API path based on provider type
    let apiUrl = body.apiUrl;
    if (body.type === 'github_enterprise' && !apiUrl.includes('/api')) {
      apiUrl = `${apiUrl}/api/v3`;
    } else if (body.type === 'gitlab_selfhosted' && !apiUrl.includes('/api')) {
      apiUrl = `${apiUrl}/api/v4`;
    }

    let backend = await scmBackendService.createScmBackend({
      tenant,
      type: body.type,
      name: body.name,
      description: undefined,
      webUrl,
      apiUrl,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      appId: body.appId,
      appSlug: body.appSlug,
      appPrivateKey: body.appPrivateKey
    });

    await scmInstallationSessionService.completeBackendSetupSession({
      sessionId,
      backend
    });

    // Determine where to redirect
    if (setupSession.parentInstallationSession) {
      return c.redirect(`/origin/scm/installation-session/${setupSession.parentInstallationSession.id}`);
    }

    if (setupSession.redirectUrl) {
      return c.redirect(setupSession.redirectUrl);
    }

    return c.html(completeDashboardHtml());
  });
