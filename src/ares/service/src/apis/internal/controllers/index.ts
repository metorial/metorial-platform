import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { internalApp } from '../_app';
import { appController } from './app';
import { oauthController } from './oauth';
import { sessionController } from './session';
import { ssoController } from './sso';
import { ssoV2Controller } from './ssoV2';
import { syncListenerController } from './syncListener';
import { tenantController } from './tenant';
import { userController } from './user';

let rootController = internalApp.controller({
  app: appController,
  tenant: tenantController,
  user: userController,
  syncListener: syncListenerController,
  sso: ssoController,
  ssoV2: ssoV2Controller,
  oauth: oauthController,
  session: sessionController
});

export let internalRPC = createServer({})(rootController);

export type InternalClient = InferClient<typeof rootController>;
