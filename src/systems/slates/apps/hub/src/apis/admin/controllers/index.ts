import { createServer, rpcMux, type InferClient } from '@mtsrc/rpc-server';
import { app } from './_app';
import { authController } from './auth';
import { slateController } from './slate';
import { slateDeploymentController } from './slateDeployment';
import { slateDiscoveryController } from './slateDiscovery';
import { slateEventController } from './slateEvent';
import { slateVersionController } from './slateVersion';

export let rootController = app.controller({
  auth: authController,
  slate: slateController,
  slateVersion: slateVersionController,
  slateDeployment: slateDeploymentController,
  slateEvent: slateEventController,
  slateDiscovery: slateDiscoveryController
});

export let slatesHubAdminRPC = createServer({})(rootController);
export let slatesHubAdminApi = rpcMux({ path: '/slates-hub-admin' }, [
  slatesHubAdminRPC
]);

export type SlatesHubAdminClient = InferClient<typeof rootController>;
