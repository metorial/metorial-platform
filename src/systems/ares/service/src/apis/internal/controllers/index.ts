import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { internalApp } from '../_app';
import { appController } from './app';
import { oauthController } from './oauth';
import { sessionController } from './session';
import { ssoController } from './sso';
import { tenantController } from './tenant';
import { userController } from './user';

let rootController = internalApp.controller({
  app: appController,
  tenant: tenantController,
  user: userController,
  sso: ssoController,
  oauth: oauthController,
  session: sessionController
});

export let internalRPC = createServer({})(rootController);

export type InternalClient = InferClient<typeof rootController>;
