import { apiMux } from '@lowerdeck/api-mux';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { actorController } from './actor';
import { agentController } from './agent';
import { agentClientController } from './agentClient';
import { agentInstanceController } from './agentInstance';
import { adminProviderTelemetryController } from './adminProviderTelemetry';
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
import { enclaveController } from './enclave';
import { firewallController } from './firewall';
import { firewallBindingController } from './firewallBinding';
import { networkController } from './network';
import { networkPolicyController } from './networkPolicy';
import { customProviderVersionController } from './customProviderVersion';
import { environmentController } from './environment';
import { ephemeralManagedSessionController } from './ephemeralManagedSession';
import { identityController } from './identity';
import { identityActorController } from './identityActor';
import { identityCredentialController } from './identityCredential';
import { identityDelegationController } from './identityDelegation';
import { identityDelegationConfigController } from './identityDelegationConfig';
import { identityDelegationRequestController } from './identityDelegationRequest';
import { integrationController } from './integration';
import { integrationInstanceController } from './integrationInstance';
import { integrationInstanceGroupController } from './integrationInstanceGroup';
import { integrationInstanceGroupProviderController } from './integrationInstanceGroupProvider';
import { integrationInstanceProviderController } from './integrationInstanceProvider';
import { integrationProviderController } from './integrationProvider';
import { integrationSetupSessionController } from './integrationSetupSession';
import { integrationVersionController } from './integrationVersion';
import { magicMcpBackingController } from './magicMcpBacking';
import { magicMcpServerProviderController } from './magicMcpServerProvider';
import { managedProviderAuthCredentialsController } from './managedProviderAuthCredentials';
import { monitorController } from './monitor';
import { monitorAlertController } from './monitorAlert';
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
import { providerSpecificationChangeNotificationController } from './providerSpecificationChangeNotification';
import { providerSpecificationController } from './providerSpecification';
import { providerToolController } from './providerTool';
import { providerTriggerController } from './providerTrigger';
import { providerVariantController } from './providerVariant';
import { providerVersionController } from './providerVersion';
import { protoGuardAlertController } from './protoGuardAlert';
import { protoGuardConfigController } from './protoGuardConfig';
import { publisherController } from './publisher';
import { resourceCountController } from './resourceCount';
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
import { skillController } from './skill';
import { skillGroupController } from './skillGroup';
import { skillGroupItemController } from './skillGroupItem';
import { skillItemController } from './skillItem';
import { skillTemplateController } from './skillTemplate';
import { skillTemplateItemController } from './skillTemplateItem';
import { solutionController } from './solution';
import { tenantController } from './tenant';
import { toolCallController } from './toolCall';

let systemControllers = {
  environment: environmentController,
  actor: actorController,
  solution: solutionController,
  tenant: tenantController
};

let agentControllers = {
  agent: agentController,
  agentClient: agentClientController,
  agentInstance: agentInstanceController
};

let identityControllers = {
  identity: identityController,
  identityActor: identityActorController,
  identityDelegation: identityDelegationController,
  identityDelegationConfig: identityDelegationConfigController,
  identityDelegationRequest: identityDelegationRequestController,
  integrationInstanceGroup: integrationInstanceGroupController,
  integrationInstanceGroupProvider: integrationInstanceGroupProviderController,
  identityCredential: identityCredentialController
};

let integrationControllers = {
  integration: integrationController,
  integrationSetupSession: integrationSetupSessionController,
  integrationInstance: integrationInstanceController,
  integrationInstanceProvider: integrationInstanceProviderController,
  integrationProvider: integrationProviderController,
  integrationVersion: integrationVersionController,
  magicMcpBacking: magicMcpBackingController,
  magicMcpServerProvider: magicMcpServerProviderController
};

let configControllers = {
  authConfigEvent: authConfigEventController,
  authConfigError: authConfigErrorController,
  authConfigErrorGlobal: authConfigErrorGlobalController,
  monitor: monitorController,
  monitorAlert: monitorAlertController,
  protoGuardAlert: protoGuardAlertController,
  protoGuardConfig: protoGuardConfigController
};

let callbackControllers = {
  brand: brandController,
  callback: callbackController,
  callbackDestination: callbackDestinationController,
  callbackEvent: callbackEventController,
  callbackInstance: callbackInstanceController,
  callbackDelivery: callbackDeliveryController,
  callbackDeliveryAttempt: callbackDeliveryAttemptController,
  publisher: publisherController,
  toolCall: toolCallController
};

let providerControllers = {
  adminProviderTelemetry: adminProviderTelemetryController,
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
  enclave: enclaveController,
  network: networkController,
  firewall: firewallController,
  firewallBinding: firewallBindingController,
  networkPolicy: networkPolicyController,
  providerListing: providerListingController,
  providerOAuthSetup: providerOAuthSetupController,
  providerSpecification: providerSpecificationController,
  providerSpecificationChangeNotification: providerSpecificationChangeNotificationController,
  providerTool: providerToolController,
  providerTrigger: providerTriggerController,
  providerVariant: providerVariantController,
  providerVersion: providerVersionController,
  resourceCount: resourceCountController,
  providerRun: providerRunController
};

let sessionControllers = {
  session: sessionController,
  ephemeralManagedSession: ephemeralManagedSessionController,
  sessionProvider: sessionProviderController,
  sessionConnection: sessionConnectionController,
  sessionError: sessionErrorController,
  sessionErrorGroup: sessionErrorGroupController,
  sessionEvent: sessionEventController,
  sessionMessage: sessionMessageController,
  sessionParticipant: sessionParticipantController,
  sessionTemplate: sessionTemplateController,
  sessionTemplateProvider: sessionTemplateProviderController,
  sessionUsageRecord: sessionUsageRecordController,
  providerRunUsageRecord: providerRunUsageRecordController
};

let skillControllers = {
  skill: skillController,
  skillGroup: skillGroupController,
  skillGroupItem: skillGroupItemController,
  skillItem: skillItemController,
  skillTemplate: skillTemplateController,
  skillTemplateItem: skillTemplateItemController
};

let extensionControllers = {
  customProvider: customProviderController,
  customProviderCommit: customProviderCommitController,
  customProviderDeployment: customProviderDeploymentController,
  customProviderVersion: customProviderVersionController,
  customProviderEnvironment: customProviderEnvironmentController,
  containerRegistry: containerRegistryController,
  containerRepository: containerRepositoryController,
  scmConnection: scmConnectionController,
  scmConnectionSetupSession: scmConnectionSetupSessionController,
  scmProvider: scmProviderController,
  scmProviderSetupSession: scmProviderSetupSessionController,
  scmRepository: scmRepositoryController,
  scmPush: scmPushController,
  bucket: bucketController
};

type SystemControllers = typeof systemControllers;
type CallbackControllers = typeof callbackControllers;
type ProviderControllers = typeof providerControllers;
type SessionControllers = typeof sessionControllers;
type SkillControllers = typeof skillControllers;
type ExtensionControllers = typeof extensionControllers;
type AgentControllers = typeof agentControllers;
type IdentityControllers = typeof identityControllers;
type IntegrationControllers = typeof integrationControllers;
type ConfigControllers = typeof configControllers;

type RootController = SystemControllers &
  CallbackControllers &
  ProviderControllers &
  SessionControllers &
  SkillControllers &
  ExtensionControllers &
  AgentControllers &
  IdentityControllers &
  IntegrationControllers &
  ConfigControllers;

let createRootController = (): RootController =>
  app.controller({
    ...systemControllers,
    ...callbackControllers,
    ...providerControllers,
    ...sessionControllers,
    ...skillControllers,
    ...extensionControllers,
    ...agentControllers,
    ...identityControllers,
    ...integrationControllers,
    ...configControllers
  });

export type SubspaceControllerRoot = RootController;

let rootController: SubspaceControllerRoot = createRootController();

export let subspaceControllerRPC = createServer({})(rootController);
export let subspaceControllerApi = apiMux([
  {
    endpoint: rpcMux({ path: '/subspace-controller', allowRootSpan: true }, [
      subspaceControllerRPC
    ])
  }
]);

export type SubspaceControllerClient = InferClient<typeof rootController>;
