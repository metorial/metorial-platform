import { createHono, useRequestContext, useValidatedQuery } from '@metorial/hono';
import { scmAuthService } from '@metorial/module-scm';
import { v } from '@metorial/validation';
import { completeDashboardHtml } from '../templates/completeDashboard';

export let scmController = createHono().get('/oauth/github/callback', async c => {
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
});
