import { createHono } from '@lowerdeck/hono';
import { ssoAuthApp } from './auth';
import { ssoDelegationApp } from './delegation';
import { jxnApp } from './jxn';
import { scimApp } from './scim';
import { setupApp } from './setup';

export let endpointApp = createHono()
  .route('/sso/jxn', jxnApp)
  .route('/sso/scim', scimApp)
  .route('/sso/setup', setupApp)
  .route('/sso/auth', ssoAuthApp)
  .route('/metorial-ares/sso-delegation', ssoDelegationApp);
