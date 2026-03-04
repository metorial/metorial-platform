import { createHono } from '@lowerdeck/hono';
import { providerCategoriesController } from './controllers/providerCategories';
import { providerCollectionsController } from './controllers/providerCollections';
import { providerListingsController } from './controllers/providerListings';

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
  .get('/ping', c => c.text('OK'))
  .route('/provider-listings', providerListingsController)
  .route('/provider-categories', providerCategoriesController)
  .route('/provider-collections', providerCollectionsController);
