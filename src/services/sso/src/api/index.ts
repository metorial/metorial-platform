import { createHono } from '@metorial/hono';
import { authApi } from './auth';
import { jxnApi } from './jxn';
import { setupApi } from './setup';

let api = createHono()
  .get('/ping', async c => c.json({ ok: true }))
  .route('/sso/jxn', jxnApi)
  .route('/sso/setup', setupApi)
  .route('/sso/auth', authApi);

Bun.serve({
  port: 4340,
  fetch: api.fetch
});
