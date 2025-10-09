import { createHono } from '@metorial/hono';
import { scmController } from './controllers/scm';

export let integrationsApp = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/integrations/scm/', scmController);
