import { createHono } from '@lowerdeck/hono';
import { changeNotificationsController } from './changeNotification';
import { infoController } from './info';
import { scopesController } from './scope';
import { slatesController } from './slate';
import { usersController } from './user';
import { workspacesController } from './workspace';

export let registryApp = createHono()
  .use(async (c, next) => {
    await next();

    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
  })
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/info', infoController)
  .route('/scopes', scopesController)
  .route('/users', usersController)
  .route('/workspaces', workspacesController)
  .route('/slates', slatesController)
  .route('/change-notifications', changeNotificationsController);
