import { createHono, useValidatedQuery } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import crypto from 'crypto';
import { env } from '../env';
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
        installation_id: v.optional(v.string()),
        setup_action: v.enumOf(['install', 'update', 'request']),
        code: v.optional(v.string()),
        state: v.optional(v.string())
      })
    );

    let result = await scmAuthService.handleInstallation({
      installationId: query.installation_id,
      setupAction: query.setup_action,
      code: query.code,
      state: query.state,
      provider: 'github'
    });

    if (result.sessionId) {
      return c.redirect(`/origin/scm/installation-session/${result.sessionId}`);
    }
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
  .get('/origin/oauth/bitbucket/callback', async c => {
    let query = await useValidatedQuery(
      c,
      v.object({
        code: v.string(),
        state: v.string()
      })
    );
    await scmAuthService.handleBitbucketOAuthCallback({
      code: query.code,
      state: query.state,
      provider: 'bitbucket'
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
  .post('/origin/webhook-ingest/github-app', async c => {
    let secret = env.gh.SCM_GITHUB_APP_WEBHOOK_SECRET;
    if (!secret) return c.text('Not Found', 404);

    let eventType = c.req.header('X-GitHub-Event');
    let signature = c.req.header('X-Hub-signature-256');
    let deliveryId = c.req.header('X-GitHub-Delivery');
    if (!eventType || !signature || !deliveryId) return c.text('Missing params', 400);

    let payload = await c.req.text();
    let expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    let receivedBuffer = Buffer.from(signature);
    let expectedBuffer = Buffer.from(expected);
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return c.text('Invalid signature', 401);
    }

    if (eventType === 'installation') {
      let event = JSON.parse(payload) as { action?: string; installation?: { id?: number } };
      if (event.action === 'created' && event.installation?.id != null) {
        await scmAuthService.handleGitHubAppInstallationCreated({
          installationId: String(event.installation.id)
        });
      }
    }
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
  })
  .post('/origin/webhook-ingest/bb/:webhookId', async c => {
    let webhookId = c.req.param('webhookId');
    let eventType = c.req.header('X-Event-Key');
    let signature = c.req.header('X-Hub-Signature');
    let idempotencyKey =
      c.req.header('X-Request-UUID') ?? c.req.header('X-Request-ID') ?? signature;
    if (!eventType || !signature || !idempotencyKey) {
      return c.text('Missing params', 400);
    }
    await scmRepoService.receiveBitbucketWebhookEvent({
      webhookId,
      eventType,
      signature,
      idempotencyKey,
      payload: await c.req.text()
    });
    return c.text('OK');
  });
