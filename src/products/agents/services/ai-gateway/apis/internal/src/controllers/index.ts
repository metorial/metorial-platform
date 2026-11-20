import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { catalogController } from './catalog';
import { gatewayTokenController } from './gatewayToken';
import { inferenceLogController } from './inferenceLog';
import { providerConnectionController } from './providerConnection';
import { routingController } from './routing';
import { instanceController, organizationController, projectController } from './scope';

export let rootController = app.controller({
  organization: organizationController,
  project: projectController,
  instance: instanceController,
  gatewayToken: gatewayTokenController,
  providerConnection: providerConnectionController,
  routing: routingController,
  catalog: catalogController,
  inferenceLog: inferenceLogController
});

export let AiGatewayRPC = createServer({})(rootController);
export let aiGatewayRpcApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-ai-gateway' }, [AiGatewayRPC]) }
]);

export type AiGatewayClient = InferClient<typeof rootController>;
