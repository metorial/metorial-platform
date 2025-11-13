import { createServer, rpcMux } from '@metorial/rpc';
import { internalApp } from './_app';
import { authController } from './controllers/auth';
import { tenantController } from './controllers/tenant';

let rootController = internalApp.controller({
  auth: authController,
  tenant: tenantController
});

export let internalRPC = createServer({})(rootController);

export let internalApi = rpcMux({ path: '/metorial-sso' }, []);

Bun.serve({
  port: 4341,
  fetch: internalApi.fetch
});
