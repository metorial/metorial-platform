import { apiMux } from '@lowerdeck/api-mux';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { callbackRegistrationController } from './callbackRegistration';
import { changeNotificationController } from './changeNotification';
import { registryController } from './registry';
import { secretController } from './secret';
import { slateController } from './slate';
import { slateAuthConfigController } from './slateAuthConfig';
import { slateAuthConfigEventController } from './slateAuthConfigEvent';
import { slateDeploymentController } from './slateDeployment';
import { slateDiscoveryController } from './slateDiscovery';
import { slateErrorController } from './slateError';
import { slateEventController } from './slateEvent';
import { slateInstanceController } from './slateInstance';
import { slateInvocationController } from './slateInvocation';
import { slateOAuthCredentialsController } from './slateOAuthCredentials';
import { slateOAuthSetupController } from './slateOAuthSetup';
import { slateOAuthSetupEventController } from './slateOAuthSetupEvent';
import { slateSessionController } from './slateSession';
import { slateSessionToolCallController } from './slateSessionToolCall';
import { slateSpecificationController } from './slateSpecification';
import { slateSpecificationChangeController } from './slateSpecificationChange';
import { slateTriggerEventController } from './slateTriggerEvent';
import { slateTriggerEventInputController } from './slateTriggerEventInput';
import { slateTriggerInvocationController } from './slateTriggerInvocation';
import { slateTriggerReceiverController } from './slateTriggerReceiver';
import { slateVersionController } from './slateVersion';
import { slateVersionDiscoveryController } from './slateVersionDiscovery';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  secret: secretController,
  callbackRegistration: callbackRegistrationController,

  registry: registryController,

  changeNotification: changeNotificationController,

  slate: slateController,
  slateVersion: slateVersionController,
  slateInvocation: slateInvocationController,
  slateDeployment: slateDeploymentController,
  slateError: slateErrorController,
  slateDiscovery: slateDiscoveryController,
  slateEvent: slateEventController,
  slateSpecification: slateSpecificationController,
  slateInstance: slateInstanceController,
  slateOAuthCredentials: slateOAuthCredentialsController,
  slateOAuthSetup: slateOAuthSetupController,
  slateOAuthSetupEvent: slateOAuthSetupEventController,
  slateAuthConfig: slateAuthConfigController,
  slateAuthConfigEvent: slateAuthConfigEventController,
  slateSession: slateSessionController,
  slateSessionToolCall: slateSessionToolCallController,

  slateTriggerReceiver: slateTriggerReceiverController,
  slateTriggerEvent: slateTriggerEventController,
  slateTriggerEventInput: slateTriggerEventInputController,
  slateTriggerInvocation: slateTriggerInvocationController,
  slateVersionDiscovery: slateVersionDiscoveryController,
  slateSpecificationChange: slateSpecificationChangeController
});

export let slatesHubRPC = createServer({})(rootController);
export let slatesHubApi = apiMux([
  { endpoint: rpcMux({ path: '/slates-hub' }, [slatesHubRPC]) }
]);

export type SlatesHubClient = InferClient<typeof rootController>;
