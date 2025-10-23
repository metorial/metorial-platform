import { createHono } from '@metorial/hono';
import { callbacksController } from './controllers/callbacks';

export let callbacksApp = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/callbacks', callbacksController);
