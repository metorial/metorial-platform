import { createHono } from '@lowerdeck/hono';
import { env } from '../env';
import { integrationsRedirectUrl } from '../urls';

export let setupSessionApp = createHono().get('/:sessionId', c => {
  return c.redirect(
    integrationsRedirectUrl(
      env.service.INTEGRATIONS_UI_URL,
      `/setup-session/${c.req.param('sessionId')}`,
      c.req.url
    )
  );
});
