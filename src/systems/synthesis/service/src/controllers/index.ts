import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { actorController, environmentController, tenantController } from './tenant';
import { assistantController } from './assistant';
import { conversationController } from './conversation';
import { messageController } from './message';
import { requestController } from './request';

export let rootController = app.controller({
  tenant: tenantController,
  environment: environmentController,
  actor: actorController,
  assistant: assistantController,
  conversation: conversationController,
  message: messageController,
  request: requestController
});

export let SynthesisRPC = createServer({})(rootController);
export let SynthesisApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-synthesis' }, [SynthesisRPC]) }
]);

export type SynthesisClient = InferClient<typeof rootController>;
