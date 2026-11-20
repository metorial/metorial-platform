import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { catalogController } from './catalog';
import { gatewayTokenController } from './gatewayToken';
import { inferenceLogController } from './inferenceLog';
import { platformLimitController } from './platformLimit';
import { providerConnectionController } from './providerConnection';
import { routingController } from './routing';
import { instanceController, organizationController, projectController } from './scope';
import { virtualModelController } from './virtualModel';

export let rootController = app.controller({
  organization: organizationController,
  project: projectController,
  instance: instanceController,
  gatewayToken: gatewayTokenController,
  providerConnection: providerConnectionController,
  routing: routingController,
  virtualModel: virtualModelController,
  catalog: catalogController,
  inferenceLog: inferenceLogController,
  platformLimit: platformLimitController
});

export let AiGatewayRPC = createServer({})(rootController);
export let aiGatewayRpcApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-ai-gateway' }, [AiGatewayRPC]) }
]);

export type AiGatewayClient = InferClient<typeof rootController>;
