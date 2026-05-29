import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { changeNotificationController } from './changeNotification';
import { containerRegistryController } from './containerRegistry';
import { containerRepositoryController } from './containerRepository';
import { containerRepositoryTagController } from './containerRepositoryTag';
import { containerRepositoryVersionController } from './containerRepositoryVersion';
import { functionServerInvocationController } from './functionServerInvocation';
import { serverController } from './server';
import { serverAuthConfigController } from './serverAuthConfig';
import { serverAuthConfigEventController } from './serverAuthConfigEvent';
import { serverConfigController } from './serverConfig';
import { serverConnectionController } from './serverConnection';
import { serverDeploymentController } from './serverDeployment';
import { serverDiscoveryController } from './serverDiscovery';
import { serverOAuthCredentialsController } from './serverOAuthCredentials';
import { serverOAuthSetupController } from './serverOAuthSetup';
import { serverOAuthSetupEventController } from './serverOAuthSetupEvent';
import { serverVersionController } from './serverVersion';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,

  containerRegistry: containerRegistryController,
  containerRepository: containerRepositoryController,
  containerRepositoryTag: containerRepositoryTagController,
  containerRepositoryVersion: containerRepositoryVersionController,
  functionServerInvocation: functionServerInvocationController,

  server: serverController,
  serverVersion: serverVersionController,
  serverDiscovery: serverDiscoveryController,
  serverConfig: serverConfigController,
  serverDeployment: serverDeploymentController,
  serverConnection: serverConnectionController,
  serverAuthConfig: serverAuthConfigController,
  serverAuthConfigEvent: serverAuthConfigEventController,

  serverOAuthSetup: serverOAuthSetupController,
  serverOAuthSetupEvent: serverOAuthSetupEventController,
  serverOAuthCredentials: serverOAuthCredentialsController,

  changeNotification: changeNotificationController
});

export let ShuttleRPC = createServer({})(rootController);

export type ShuttleClient = InferClient<typeof rootController>;
