import { createServer, InferClient, rpcMux } from '@metorial/rpc';
import { publicApp } from './middleware/public';

let rootController = publicApp.controller({});

export let customPortalRPC = createServer({})(rootController);

export let customPortalApi = rpcMux(
  {
    cors: { check: () => true },
    path: '/metorial-custom-portal'
  },
  [customPortalRPC]
);

export type CustomPortalClient = InferClient<typeof rootController>;
