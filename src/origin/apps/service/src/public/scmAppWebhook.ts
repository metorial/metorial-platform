import { createHono } from '@lowerdeck/hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../db';
import { assertScmBackendAllowed } from '../lib/scmPolicy';
import { scmAuthService } from '../services/scmAuth';

export let scmAppWebhookController = createHono().post(
  '/origin/webhook-ingest/github-app/:backendId',
  async c => {
    let backend = await db.scmBackend.findUnique({ where: { id: c.req.param('backendId') } });
    if (
      !backend ||
      !['github', 'github_enterprise'].includes(backend.type) ||
      !backend.appWebhookSecret
    )
      return c.text('Not Found', 404);
    assertScmBackendAllowed(backend);

    let payload = await c.req.text();
    let received = Buffer.from(c.req.header('X-Hub-Signature-256') ?? '');
    let expected = Buffer.from(
      `sha256=${createHmac('sha256', backend.appWebhookSecret).update(payload).digest('hex')}`
    );
    if (received.length !== expected.length || !timingSafeEqual(received, expected))
      return c.text('Invalid signature', 401);

    if (c.req.header('X-GitHub-Event') === 'installation') {
      let event = JSON.parse(payload) as { action?: string; installation?: { id?: number } };
      if (event.action === 'created' && event.installation?.id != null)
        await scmAuthService.handleGitHubAppInstallationCreated({
          backend,
          installationId: String(event.installation.id)
        });
    }

    return c.text('OK');
  }
);
