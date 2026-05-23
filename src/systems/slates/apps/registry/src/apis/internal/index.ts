import { apiMux } from '@mtsrc/api-mux';
import { createServer, type InferClient, rpcMux } from '@mtsrc/rpc-server';
import { app } from './_app';
import { readerTokenController } from './readerTokens';
import { subRegistryController } from './subRegistry';
import { tenantController } from './tenant';
import { userController } from './user';
import { workspaceController } from './workspace';

export let rootController = app.controller({
  tenant: tenantController,
  user: userController,
  workspace: workspaceController,
  readerToken: readerTokenController,
  subRegistry: subRegistryController
});

export let slatesRegistryRPC = createServer({})(rootController);
export let slatesRegistryApi = apiMux([
  { endpoint: rpcMux({ path: '/slates-registry' }, [slatesRegistryRPC]) }
]);

export type SlatesRegistryClient = InferClient<typeof rootController>;
