import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { ingestTokenController } from './ingestToken';
import { recordsController } from './records';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  ingestToken: ingestTokenController,
  records: recordsController
});

export let GroundstationRPC = createServer({})(rootController);
export let GroundstationApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-groundstation' }, [GroundstationRPC]) }
]);

export type GroundstationClient = InferClient<typeof rootController>;
