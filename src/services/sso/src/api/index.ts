import { createHono } from '@metorial/hono';
import { jxnApi } from './jxn';
import { setupApi } from './setup';
import { testApi } from './test';

let api = createHono()
  .get('/ping', async c => c.json({ ok: true }))
  .route('/sso/jxn', jxnApi)
  .route('/sso/setup', setupApi)
  .route('/sso/test', testApi);

Bun.serve({
  port: 4340,
  fetch: api.fetch
});
