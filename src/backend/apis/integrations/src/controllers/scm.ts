import { createHono, useRequestContext, useValidatedQuery } from '@metorial/hono';
import { scmAuthService, scmRepoService } from '@metorial/module-scm';
import { v } from '@metorial/validation';
import { completeDashboardHtml } from '../templates/completeDashboard';

export let scmController = createHono()
  .get('/oauth/github/callback', async c => {
    let context = useRequestContext(c);
    let query = await useValidatedQuery(
      c,
      v.object({
        code: v.string(),
        state: v.string()
      })
    );

    let auth = await scmAuthService.exchangeCodeForToken({
      code: query.code,
      state: query.state,
      provider: 'github'
    });

    return c.html(completeDashboardHtml());
  })
  .get('/webhook-ingest/gh/:webhookId', async c => {
    let webhookId = c.req.param('webhookId');

    let eventType = c.req.header('X-GitHub-Event');
    let signature = c.req.header('X-Hub-signature-256');
    let idempotencyKey = c.req.header('X-GitHub-Delivery');

    if (!eventType || !signature || !idempotencyKey) {
      return c.text('Missing params', 400);
    }

    await scmRepoService.receiveWebhookEvent({
      idempotencyKey,
      eventType,
      signature,
      webhookId,
      payload: await c.req.text()
    });
  });
