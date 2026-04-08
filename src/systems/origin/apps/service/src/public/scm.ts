import { createHono, useValidatedQuery } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { completeDashboardHtml } from '../lib/templates/completeDashboard';
import { scmAuthService, scmRepoService } from '../services';
import { scmBackendSetupPublicController } from './scmBackendSetup';
import { scmInstallationSessionPublicController } from './scmInstallationSession';

export let scmController = createHono()
  .get('/ping', () => new Response('OK'))
  .route('/origin/scm/installation-session', scmInstallationSessionPublicController)
  .route('/origin/scm', scmBackendSetupPublicController)
  .get('/origin/oauth/github/callback', async c => {
    let query = await useValidatedQuery(
      c,
      v.object({
        installation_id: v.string(),
        setup_action: v.string(),
        state: v.string()
      })
    );

    await scmAuthService.handleInstallation({
      installationId: query.installation_id,
      setupAction: query.setup_action,
      state: query.state,
      provider: 'github'
    });

    return c.html(completeDashboardHtml());
  })
  .get('/origin/oauth/gitlab/callback', async c => {
    let query = await useValidatedQuery(
      c,
      v.object({
        code: v.string(),
        state: v.string()
      })
    );

    await scmAuthService.handleGitLabOAuthCallback({
      code: query.code,
      state: query.state,
      provider: 'gitlab'
    });

    return c.html(completeDashboardHtml());
  })
  .post('/origin/webhook-ingest/gh/:webhookId', async c => {
    let webhookId = c.req.param('webhookId');

    let eventType = c.req.header('X-GitHub-Event');
    let signature = c.req.header('X-Hub-signature-256');
    let idempotencyKey = c.req.header('X-GitHub-Delivery');

    if (!eventType || !signature || !idempotencyKey) {
      return c.text('Missing params', 400);
    }

    await scmRepoService.receiveGitHubWebhookEvent({
      idempotencyKey,
      eventType,
      signature,
      webhookId,
      payload: await c.req.text()
    });

    return c.text('OK');
  })
  .post('/origin/webhook-ingest/gl/:webhookId', async c => {
    let webhookId = c.req.param('webhookId');

    let eventType = c.req.header('X-Gitlab-Event');
    let token = c.req.header('X-Gitlab-Token');
    let idempotencyKey = c.req.header('X-Gitlab-Event-UUID');

    if (!eventType || !token || !idempotencyKey) {
      return c.text('Missing params', 400);
    }

    await scmRepoService.receiveGitLabWebhookEvent({
      idempotencyKey,
      eventType,
      token,
      webhookId,
      payload: await c.req.text()
    });

    return c.text('OK');
  });
