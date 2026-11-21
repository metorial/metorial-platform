import { userTwoFactorController } from './userTwoFactor';
import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { checkEdition } from '@metorial/editions';
import { internalApp } from '../_app';
import { appController } from './app';
import { oauthController } from './oauth';
import type { registeredDomainPolicyController as OnPremController } from './registeredDomainPolicy';
import { sessionController } from './session';
import { ssoController } from './sso';
import { ssoV2Controller } from './ssoV2';
import { syncListenerController } from './syncListener';
import { tenantController } from './tenant';
import { userController } from './user';
import { userPasswordController } from './userPassword';

let registeredDomainPolicyController = (
  checkEdition('on-prem')
    ? (await import('./registeredDomainPolicy')).registeredDomainPolicyController
    : internalApp.controller({})
) as typeof OnPremController;

let rootController = internalApp.controller({
  app: appController,
  tenant: tenantController,
  user: userController,
  userPassword: userPasswordController,
  userTwoFactor: userTwoFactorController,
  syncListener: syncListenerController,
  sso: ssoController,
  ssoV2: ssoV2Controller,
  oauth: oauthController,
  registeredDomainPolicy: registeredDomainPolicyController,
  session: sessionController
});

export let internalRPC = createServer({})(rootController);

export type InternalClient = InferClient<typeof rootController>;
