import { apiMux } from '@lowerdeck/api-mux';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { actorController } from './actor';
import { authConfigErrorController } from './authConfigError';
import { authConfigErrorGlobalController } from './authConfigErrorGlobal';
import { authConfigEventController } from './authConfigEvent';
import { brandController } from './brand';
import { bucketController } from './bucket';
import { callbackController } from './callback';
import { callbackDeliveryController } from './callbackDelivery';
import { callbackDeliveryAttemptController } from './callbackDeliveryAttempt';
import { callbackDestinationController } from './callbackDestination';
import { callbackEventController } from './callbackEvent';
import { callbackInstanceController } from './callbackInstance';
import { containerRegistryController } from './containerRegistry';
import { containerRepositoryController } from './containerRepository';
import { customProviderController } from './customProvider';
import { customProviderCommitController } from './customProviderCommit';
import { customProviderDeploymentController } from './customProviderDeployment';
import { customProviderEnvironmentController } from './customProviderEnvironment';
import { customProviderVersionController } from './customProviderVersion';
import { environmentController } from './environment';
import { identityController } from './identity';
import { identityActorController } from './identityActor';
import { identityCredentialController } from './identityCredential';
import { identityDelegationController } from './identityDelegation';
import { identityDelegationConfigController } from './identityDelegationConfig';
import { identityDelegationRequestController } from './identityDelegationRequest';
import { managedProviderAuthCredentialsController } from './managedProviderAuthCredentials';
import { networkingRulesetController } from './networkingRuleset';
import { providerController } from './provider';
import { providerAuthConfigController } from './providerAuthConfig';
import { providerAuthCredentialsController } from './providerAuthCredentials';
import { providerAuthExportController } from './providerAuthExport';
import { providerAuthImportController } from './providerAuthImport';
import { providerAuthMethodController } from './providerAuthMethod';
import { providerListingCategoryController } from './providerCategory';
import { providerListingCollectionController } from './providerCollection';
import { providerConfigController } from './providerConfig';
import { providerConfigVaultController } from './providerConfigVault';
import { providerDeploymentController } from './providerDeployment';
import { providerListingGroupController } from './providerGroup';
import { providerInvocationController } from './providerInvocation';
import { providerListingController } from './providerListing';
import { providerOAuthSetupController } from './providerOAuthSetup';
import { providerRunController } from './providerRun';
import { providerRunUsageRecordController } from './providerRunUsageRecord';
import { providerSetupSessionController } from './providerSetupSession';
import { providerSpecificationController } from './providerSpecification';
import { providerToolController } from './providerTool';
import { providerTriggerController } from './providerTrigger';
import { providerVariantController } from './providerVariant';
import { providerVersionController } from './providerVersion';
import { publisherController } from './publisher';
import { scmConnectionController } from './scmConnection';
import { scmConnectionSetupSessionController } from './scmConnectionSetupSession';
import { scmProviderController } from './scmProvider';
import { scmProviderSetupSessionController } from './scmProviderSetupSession';
import { scmPushController } from './scmPush';
import { scmRepositoryController } from './scmRepository';
import { sessionController } from './session';
import { sessionConnectionController } from './sessionConnection';
import { sessionErrorController } from './sessionError';
import { sessionErrorGroupController } from './sessionErrorGlobal';
import { sessionEventController } from './sessionEvent';
import { sessionMessageController } from './sessionMessage';
import { sessionParticipantController } from './sessionParticipant';
import { sessionProviderController } from './sessionProvider';
import { sessionTemplateController } from './sessionTemplate';
import { sessionTemplateProviderController } from './sessionTemplateProvider';
import { sessionUsageRecordController } from './sessionUsageRecord';
import { solutionController } from './solution';
import { tenantController } from './tenant';
import { toolCallController } from './toolCall';

export let rootController = app.controller({
  environment: environmentController,
  actor: actorController,
  authConfigEvent: authConfigEventController,
  authConfigError: authConfigErrorController,
  authConfigErrorGlobal: authConfigErrorGlobalController,
  identity: identityController,
  identityActor: identityActorController,
  identityDelegation: identityDelegationController,
  identityDelegationConfig: identityDelegationConfigController,
  identityDelegationRequest: identityDelegationRequestController,
  identityCredential: identityCredentialController,
  solution: solutionController,
  tenant: tenantController,

  brand: brandController,
  callback: callbackController,
  callbackDestination: callbackDestinationController,
  callbackEvent: callbackEventController,
  callbackInstance: callbackInstanceController,
  callbackDelivery: callbackDeliveryController,
  callbackDeliveryAttempt: callbackDeliveryAttemptController,

  publisher: publisherController,

  toolCall: toolCallController,

  provider: providerController,
  providerInvocation: providerInvocationController,
  managedProviderAuthCredentials: managedProviderAuthCredentialsController,
  providerAuthConfig: providerAuthConfigController,
  providerAuthCredentials: providerAuthCredentialsController,
  providerAuthExport: providerAuthExportController,
  providerAuthImport: providerAuthImportController,
  providerAuthMethod: providerAuthMethodController,
  providerSetupSession: providerSetupSessionController,
  providerListingCategory: providerListingCategoryController,
  providerListingCollection: providerListingCollectionController,
  providerListingGroup: providerListingGroupController,
  providerConfig: providerConfigController,
  providerConfigVault: providerConfigVaultController,
  providerDeployment: providerDeploymentController,
  providerListing: providerListingController,
  providerOAuthSetup: providerOAuthSetupController,
  providerSpecification: providerSpecificationController,
  providerTool: providerToolController,
  providerTrigger: providerTriggerController,
  providerVariant: providerVariantController,
  providerVersion: providerVersionController,

  session: sessionController,
  sessionProvider: sessionProviderController,
  sessionConnection: sessionConnectionController,
  sessionError: sessionErrorController,
  sessionErrorGroup: sessionErrorGroupController,
  sessionEvent: sessionEventController,
  sessionMessage: sessionMessageController,
  sessionParticipant: sessionParticipantController,
  sessionTemplate: sessionTemplateController,
  sessionTemplateProvider: sessionTemplateProviderController,

  customProvider: customProviderController,
  customProviderCommit: customProviderCommitController,
  customProviderDeployment: customProviderDeploymentController,
  customProviderVersion: customProviderVersionController,
  customProviderEnvironment: customProviderEnvironmentController,

  containerRegistry: containerRegistryController,
  containerRepository: containerRepositoryController,
  networkingRuleset: networkingRulesetController,

  providerRun: providerRunController,

  scmConnection: scmConnectionController,
  scmConnectionSetupSession: scmConnectionSetupSessionController,
  scmProvider: scmProviderController,
  scmProviderSetupSession: scmProviderSetupSessionController,
  scmRepository: scmRepositoryController,
  scmPush: scmPushController,
  bucket: bucketController,

  sessionUsageRecord: sessionUsageRecordController,
  providerRunUsageRecord: providerRunUsageRecordController
});

export let subspaceControllerRPC = createServer({})(rootController);
export let subspaceControllerApi = apiMux([
  {
    endpoint: rpcMux({ path: '/subspace-controller', allowRootSpan: true }, [
      subspaceControllerRPC
    ])
  }
]);

export type SubspaceControllerClient = InferClient<typeof rootController>;
