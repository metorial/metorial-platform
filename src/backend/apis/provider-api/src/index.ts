import { createHono } from '@metorial/hono';
import { authConfigsController } from './controllers/authConfigs';
import { authCredentialsController } from './controllers/authCredentials';
import { authExportsController } from './controllers/authExports';
import { authImportsController } from './controllers/authImports';
import { authMethodsController } from './controllers/authMethods';
import { categoriesController } from './controllers/categories';
import { collectionsController } from './controllers/collections';
import { configsController } from './controllers/configs';
import { configVaultsController } from './controllers/configVaults';
import { deploymentsController } from './controllers/deployments';
import { groupsController } from './controllers/groups';
import { introspectController } from './introspect';
import { providersController } from './controllers/providers';
import { providerListingsController } from './controllers/providerListings';
import { publishersController } from './controllers/publishers';
import { setupSessionsController } from './controllers/setupSessions';
import { specificationsController } from './controllers/specifications';
import { toolsController } from './controllers/tools';
import { versionsController } from './controllers/versions';

export let providerApp = createHono()
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
  .route('/providers', providersController)
  .route('/provider-listings', providerListingsController)
  .route('/categories', categoriesController)
  .route('/collections', collectionsController)
  .route('/groups', groupsController)
  .route('/publishers', publishersController)
  .route('/versions', versionsController)
  .route('/specifications', specificationsController)
  .route('/tools', toolsController)
  .route('/auth-methods', authMethodsController)
  .route('/deployments', deploymentsController)
  .route('/configs', configsController)
  .route('/config-vaults', configVaultsController)
  .route('/auth-configs', authConfigsController)
  .route('/auth-credentials', authCredentialsController)
  .route('/setup-sessions', setupSessionsController)
  .route('/auth-imports', authImportsController)
  .route('/auth-exports', authExportsController)
  .route('/introspect', introspectController);
