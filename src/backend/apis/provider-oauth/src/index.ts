import { createHono } from '@metorial/hono';
import { providerOauthController } from './controllers/oauth';

export let providerOauthApp = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/provider-oauth', providerOauthController);
