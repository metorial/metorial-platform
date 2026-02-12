import { createHono } from '@metorial/hono';
import { providerOauthController } from './controllers/oauth';
import { oauthSetupCallbackController } from './controllers/oauthSetupCallback';

export let portalApp = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/oauth', providerOauthController)
  .route('/oauth-setup', oauthSetupCallbackController);
