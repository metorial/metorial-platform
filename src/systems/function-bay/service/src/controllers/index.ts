import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { functionController } from './function';
import { functionDeploymentController } from './functionDeployment';
import { functionInvocationController } from './functionInvocation';
import { functionVersionController } from './functionVersion';
import { providerController } from './provider';
import { runtimeController } from './runtime';
import { tenantController } from './tenant';

export let rootController = app.controller({
  runtime: runtimeController,
  tenant: tenantController,
  provider: providerController,
  function: functionController,
  functionVersion: functionVersionController,
  functionDeployment: functionDeploymentController,
  functionInvocation: functionInvocationController
});

export let functionBayRPC = createServer({})(rootController);
export let functionBayApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-function-bay' }, [functionBayRPC]) }
]);

export type FunctionBayClient = InferClient<typeof rootController>;
