import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { setupSessionController } from './setupSession';

export let rootFrontend = app.controller({
  setupSession: setupSessionController
});

export let subspaceFrontendRPC = createServer({})(rootFrontend);

export type SubspaceFrontendClient = InferClient<typeof rootFrontend>;
