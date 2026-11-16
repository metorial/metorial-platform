import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { authController } from './auth';
import { slateController } from './slate';
import { slatePackController } from './slatePack';
import { subRegistryController } from './subRegistry';
import { tenantController } from './tenant';
import { userController } from './user';
import { workspaceController } from './workspace';

export let rootController = app.controller({
  auth: authController,
  tenant: tenantController,
  user: userController,
  workspace: workspaceController,
  subRegistry: subRegistryController,
  slate: slateController,
  slatePack: slatePackController
});

export let slatesRegistryAdminRPC = createServer({})(rootController);
export let slatesRegistryAdminApi = rpcMux({ path: '/slates-registry-admin' }, [
  slatesRegistryAdminRPC
]);

export type SlatesRegistryAdminClient = InferClient<typeof rootController>;
