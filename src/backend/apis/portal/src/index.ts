import { createHono } from '@metorial/hono';
import { providerOauthController } from './controllers/oauth';

export let portalOauthApp = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/oauth', providerOauthController);
