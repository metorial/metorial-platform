import { createServer, InferClient, rpcMux } from '@metorial/rpc';
import { authController } from './controllers/auth';
import { bootController } from './controllers/boot';
import { publicApp } from './middleware/public';

let rootController = publicApp.controller({
  auth: authController,
  boot: bootController
});

export let customPortalRPC = createServer({})(rootController);

export let customPortalApi = rpcMux(
  {
    cors: { check: () => true, headers: ['Metorial-Portal-Id'] },
    path: '/metorial-custom-portal'
  },
  [customPortalRPC]
);

export type CustomPortalClient = InferClient<typeof rootController>;
