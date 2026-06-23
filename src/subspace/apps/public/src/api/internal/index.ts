import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { integrationSetupSessionController } from './integrationSetupSession';
import { setupSessionController } from './setupSession';

export let rootFrontend = app.controller({
  integrationSetupSession: integrationSetupSessionController,
  setupSession: setupSessionController
});

export let subspaceFrontendRPC = createServer({})(rootFrontend);

export type SubspaceFrontendClient = InferClient<typeof rootFrontend>;
