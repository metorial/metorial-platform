import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { indexController } from './_index';
import { recordController } from './record';
import { sourceController } from './source';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  source: sourceController,
  index: indexController,
  record: recordController
});

export let VoyagerRPC = createServer({})(rootController);
export let VoyagerApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-voyager' }, [VoyagerRPC]) }
]);

export type VoyagerClient = InferClient<typeof rootController>;
