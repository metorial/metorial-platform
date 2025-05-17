import { createHono } from '@metorial/hono';
import { serverCategoriesController } from './controllers/serverCategories';
import { serverCollectionsController } from './controllers/serverCollections';
import { serversController } from './controllers/servers';

export let marketplaceApp = createHono()
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
  .route('/servers', serversController)
  .route('/server-categories', serverCategoriesController)
  .route('/server-collections', serverCollectionsController);
