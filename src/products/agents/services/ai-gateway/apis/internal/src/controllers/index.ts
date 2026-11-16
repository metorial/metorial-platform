import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';

export let rootController = app.controller({});

export let AiGatewayRPC = createServer({})(rootController);
export let aiGatewayRpcApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-synthesis' }, [AiGatewayRPC]) }
]);

export type AiGatewayClient = InferClient<typeof rootController>;
