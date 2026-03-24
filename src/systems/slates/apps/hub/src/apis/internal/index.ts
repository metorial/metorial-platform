import { apiMux } from '@lowerdeck/api-mux';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { changeNotificationController } from './changeNotification';
import { registryController } from './registry';
import { secretController } from './secret';
import { slateController } from './slate';
import { slateAuthConfigController } from './slateAuthConfig';
import { slateDeploymentController } from './slateDeployment';
import { slateDiscoveryController } from './slateDiscovery';
import { slateEventController } from './slateEvent';
import { slateInstanceController } from './slateInstance';
import { slateInvocationController } from './slateInvocation';
import { slateOAuthCredentialsController } from './slateOAuthCredentials';
import { slateOAuthSetupController } from './slateOAuthSetup';
import { slateSessionController } from './slateSession';
import { slateSessionToolCallController } from './slateSessionToolCall';
import { slateSpecificationController } from './slateSpecification';
import { slateTriggerDeliveryController } from './slateTriggerDelivery';
import { slateTriggerDestinationController } from './slateTriggerDestination';
import { slateTriggerEventController } from './slateTriggerEvent';
import { slateTriggerInvocationController } from './slateTriggerInvocation';
import { slateTriggerReceiverController } from './slateTriggerReceiver';
import { slateVersionController } from './slateVersion';
import { slateVersionDiscoveryController } from './slateVersionDiscovery';
import { slateSpecificationChangeController } from './slateSpecificationChange';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  secret: secretController,

  registry: registryController,

  changeNotification: changeNotificationController,

  slate: slateController,
  slateVersion: slateVersionController,
  slateInvocation: slateInvocationController,
  slateDeployment: slateDeploymentController,
  slateDiscovery: slateDiscoveryController,
  slateEvent: slateEventController,
  slateSpecification: slateSpecificationController,
  slateInstance: slateInstanceController,
  slateOAuthCredentials: slateOAuthCredentialsController,
  slateOAuthSetup: slateOAuthSetupController,
  slateAuthConfig: slateAuthConfigController,
  slateSession: slateSessionController,
  slateSessionToolCall: slateSessionToolCallController,

  slateTriggerDestination: slateTriggerDestinationController,
  slateTriggerReceiver: slateTriggerReceiverController,
  slateTriggerEvent: slateTriggerEventController,
  slateTriggerInvocation: slateTriggerInvocationController,
  slateTriggerDelivery: slateTriggerDeliveryController,
  slateVersionDiscovery: slateVersionDiscoveryController,
  slateSpecificationChange: slateSpecificationChangeController
});

export let slatesHubRPC = createServer({})(rootController);
export let slatesHubApi = apiMux([
  { endpoint: rpcMux({ path: '/slates-hub' }, [slatesHubRPC]) }
]);

export type SlatesHubClient = InferClient<typeof rootController>;
