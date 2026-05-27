import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { enclaveController } from './enclave';
import { functionController } from './function';
import { functionDeploymentController } from './functionDeployment';
import { functionVersionController } from './functionVersion';
import { providerController } from './provider';
import { runtimeController } from './runtime';
import { tenantController } from './tenant';

export let rootController = app.controller({
  runtime: runtimeController,
  tenant: tenantController,
  provider: providerController,
  enclave: enclaveController,
  function: functionController,
  functionVersion: functionVersionController,
  functionDeployment: functionDeploymentController
});

export let functionBayRPC = createServer({})(rootController);
export let functionBayApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-function-bay' }, [functionBayRPC]) }
]);

export type FunctionBayClient = InferClient<typeof rootController>;
export type { FunctionInvokeResponse } from '../services/functionInvocation';
