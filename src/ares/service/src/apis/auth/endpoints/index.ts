import { createHono } from '@lowerdeck/hono';
import { authHooksApp } from './hooks';
import { publicApp } from './public';

export let endpointApp = createHono()
  .route('/metorial-ares/hooks', authHooksApp)
  .route('', publicApp);
