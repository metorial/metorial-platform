import { createHono } from '@lowerdeck/hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../db';
import {
  hasBackendSecret,
  hasTemplateSecret,
  readBackendSecret,
  readTemplateSecret
} from '../lib/scmCredentials';
import { assertScmBackendAllowed, isScmBackendAllowed } from '../lib/scmPolicy';
import { scmAuthService } from '../services/scmAuth';

let isValidSignature = (d: {
  secret: string;
  payload: string;
  header: string | undefined;
}) => {
  let received = Buffer.from(d.header ?? '');
  let expected = Buffer.from(
    `sha256=${createHmac('sha256', d.secret).update(d.payload).digest('hex')}`
  );

  return received.length === expected.length && timingSafeEqual(received, expected);
};

let parseCreatedInstallationId = (payload: string) => {
  let event = JSON.parse(payload) as { action?: string; installation?: { id?: number } };
  if (event.action !== 'created' || event.installation?.id == null) return null;

  return String(event.installation.id);
};

export let scmAppWebhookController = createHono().post(
  '/origin/webhook-ingest/github-app/:backendId',
  async c => {
    let backend = await db.scmBackend.findUnique({ where: { id: c.req.param('backendId') } });
    if (
      !backend ||
      !['github', 'github_enterprise'].includes(backend.type) ||
      !hasBackendSecret(backend, 'appWebhookSecret')
    )
      return c.text('Not Found', 404);
    assertScmBackendAllowed(backend);

    let webhookSecret = await readBackendSecret(
      backend,
      'appWebhookSecret',
      'origin:github:app-webhook'
    );
    if (!webhookSecret) return c.text('Not Found', 404);

    let payload = await c.req.text();
    if (
      !isValidSignature({
        secret: webhookSecret,
        payload,
        header: c.req.header('X-Hub-Signature-256')
      })
    )
      return c.text('Invalid signature', 401);

    let installationId =
      c.req.header('X-GitHub-Event') === 'installation'
        ? parseCreatedInstallationId(payload)
        : null;
    if (installationId)
      await scmAuthService.handleGitHubAppInstallationCreated({ backend, installationId });

    return c.text('OK');
  }
);

// A centrally managed GitHub App has a single webhook URL shared by every project's copy, so the
// event is verified against the template and then delivered to each copy it can concern.
export let scmTemplateAppWebhookController = createHono().post(
  '/origin/webhook-ingest/github-app-template/:templateId',
  async c => {
    let template = await db.scmBackendTemplate.findUnique({
      where: { id: c.req.param('templateId') }
    });
    if (
      !template ||
      !['github', 'github_enterprise'].includes(template.type) ||
      !hasTemplateSecret(template, 'appWebhookSecret')
    )
      return c.text('Not Found', 404);

    let webhookSecret = await readTemplateSecret(
      template,
      'appWebhookSecret',
      'origin:github:template-app-webhook'
    );
    if (!webhookSecret) return c.text('Not Found', 404);

    let payload = await c.req.text();
    if (
      !isValidSignature({
        secret: webhookSecret,
        payload,
        header: c.req.header('X-Hub-Signature-256')
      })
    )
      return c.text('Invalid signature', 401);

    let installationId =
      c.req.header('X-GitHub-Event') === 'installation'
        ? parseCreatedInstallationId(payload)
        : null;
    if (!installationId) return c.text('OK');

    let copies = await db.scmBackend.findMany({
      where: {
        templateOid: template.oid,
        OR: [
          {
            selectedInstallationSessions: {
              some: { status: 'pending_approval', expiresAt: { gt: new Date() } }
            }
          },
          { installations: { some: { externalInstallationId: installationId } } }
        ]
      }
    });

    for (let copy of copies.filter(isScmBackendAllowed)) {
      try {
        await scmAuthService.handleGitHubAppInstallationCreated({
          backend: copy,
          installationId
        });
      } catch (error) {
        console.warn(
          `GitHub installation ${installationId} did not apply to ${copy.id}`,
          error
        );
      }
    }

    return c.text('OK');
  }
);
