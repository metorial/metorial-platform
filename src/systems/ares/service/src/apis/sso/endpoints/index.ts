import { createHono } from '@lowerdeck/hono';
import { ssoAuthApp } from './auth';
import { jxnApp } from './jxn';
import { setupApp } from './setup';

export let endpointApp = createHono()
  .route('/sso/jxn', jxnApp)
  .route('/sso/setup', setupApp)
  .route('/sso/auth', ssoAuthApp);
