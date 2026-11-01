import { checkEdition } from '@metorial/editions';
import {
  scmSetupTypes,
  getScmProviderOptions,
  normalizeScmBackendUrls
} from '../lib/scmPolicy';
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
      type: checkEdition('on-prem')
        ? (getScmProviderOptions()[0]?.type ?? 'github_enterprise')
        : 'github_enterprise',
      parentInstallationSession: session
    });

    return c.html(
      backendSetupHtml({
        ...(checkEdition('on-prem')
          ? { options: getScmProviderOptions(), selectedType: setupSession.type }
          : {}),
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
        ...(checkEdition('on-prem')
          ? { options: getScmProviderOptions(), selectedType: setupSession.type }
          : {}),
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
        type: v.enumOf([...scmSetupTypes]),
        name: v.string(),
        apiUrl: v.string(),
        clientId: v.string(),
        clientSecret: v.string(),
        appId: v.optional(v.string()),
        appSlug: v.optional(v.string()),
        appPrivateKey: v.optional(v.string()),
        ...(checkEdition('on-prem') ? { appWebhookSecret: v.optional(v.string()) } : {})
      })
    );

    let setupSession = await scmInstallationSessionService.getBackendSetupSessionPublic({
      sessionId
    });

    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: setupSession.tenantOid } });

    let urls: { webUrl: string; apiUrl: string };
    if (checkEdition('on-prem')) {
      urls = normalizeScmBackendUrls(body.type, body.apiUrl);
    } else {
      let inputUrl = new URL(body.apiUrl);
      inputUrl.search = '';
      inputUrl.hash = '';
      if (body.type === 'github_enterprise') {
        inputUrl.pathname = inputUrl.pathname.replace(/\/api\/v3\/?$/, '');
      } else if (body.type === 'gitlab_selfhosted') {
        inputUrl.pathname = inputUrl.pathname.replace(/\/api\/v4\/?$/, '');
      } else {
        inputUrl.pathname = inputUrl.pathname.replace(/\/rest\/api\/(?:1\.0|latest)\/?$/, '');
      }
      let webUrl = inputUrl.toString().replace(/\/$/, '');

      let apiUrl =
        body.type === 'github_enterprise'
          ? `${webUrl}/api/v3`
          : body.type === 'gitlab_selfhosted'
            ? `${webUrl}/api/v4`
            : `${webUrl}/rest/api/1.0`;

      urls = { webUrl, apiUrl };
    }

    let backend = await scmBackendService.createScmBackend({
      tenant,
      type: body.type,
      name: body.name,
      description: undefined,
      ...urls,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      appId: body.appId,
      appSlug: body.appSlug,
      appPrivateKey: body.appPrivateKey,
      ...(checkEdition('on-prem') ? { appWebhookSecret: body.appWebhookSecret } : {})
    });

    await scmInstallationSessionService.completeBackendSetupSession({
      sessionId,
      backend
    });

    // Determine where to redirect
    if (setupSession.parentInstallationSession) {
      return c.redirect(
        `/origin/scm/installation-session/${setupSession.parentInstallationSession.id}`
      );
    }

    if (setupSession.redirectUrl) {
      return c.redirect(setupSession.redirectUrl);
    }

    return c.html(completeDashboardHtml());
  });
