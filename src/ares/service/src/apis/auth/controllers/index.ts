import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { publicApp } from '../_app';
import { authenticationController } from './auth';
import { authAttemptController } from './authAttempt';
import { authIntentController } from './authIntent';
import { deviceController } from './device';
import { oauthController } from './oauth';
import { sessionController } from './session';

let rootController = publicApp.controller({
  authentication: authenticationController,
  authAttempt: authAttemptController,
  authIntent: authIntentController,
  session: sessionController,
  device: deviceController,
  oauth: oauthController
});

export let authRPC = createServer({})(rootController);

export type AuthClient = InferClient<typeof rootController>;
