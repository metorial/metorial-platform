import { Controller } from '@metorial/rest';
import {
  callbackDocsCategory,
  configurationDocsCategory,
  customProviderDocsCategory,
  fileCollectionDocsCategory,
  identityDocsCategory,
  integrationDocsCategory,
  magicMcpDocsCategory,
  monitoringDocsCategory,
  networkDocsCategory,
  portalDocsCategory,
  providerDocsCategory,
  sessionDocsCategory,
  skillDocsCategory
} from './_categories';
import {
  consumerActivityController,
  consumerProviderController,
  consumerSessionController
} from './consumer';
import {
  dashboardAssistantController,
  dashboardAuthConfigConfigurationController,
  dashboardBootController,
  dashboardIntegrationNamingConfigurationController,
  dashboardKeyProviderController,
  dashboardOAuthAuthorizationRequestController,
  dashboardOrganizationController,
  dashboardOrganizationConfigController,
  dashboardOrganizationInviteController,
  dashboardOrganizationLayoutController,
  dashboardProjectConfigurationController,
  dashboardResourceCountsController,
  dashboardToolCallingConfigurationController,
  dashboardUsageController,
  dashboardUserController,
  flagsController,
  profileController
} from './dashboard';
import {
  agentController,
  callbackController,
  callbackDestinationController,
  callbackEventController,
  callbackInstanceController,
  callbackNotificationController,
  consumerController,
  consumerSurfaceController,
  customProviderCodeController,
  customProviderCommitController,
  customProviderController,
  customProviderDeploymentController,
  customProviderEnvironmentController,
  customProviderVersionController,
  dashboardEnclaveController,
  documentController,
  documentParticipantController,
  documentVersionController,
  enclaveController,
  fileController,
  fileLinkController,
  firewallBindingController,
  firewallController,
  identityActorController,
  identityController,
  identityCredentialController,
  identityDelegationConfigController,
  identityDelegationController,
  identityDelegationRequestController,
  instanceController,
  instancesController,
  integrationController,
  integrationInstanceController,
  integrationInstanceGroupController,
  integrationInstanceGroupProviderController,
  integrationInstanceProviderController,
  integrationProviderController,
  integrationSetupSessionController,
  magicMcpEndpointController,
  magicMcpGroupController,
  magicMcpServerController,
  magicMcpServerControllerDashboard,
  magicMcpSessionController,
  magicMcpTokenController,
  monitorAlertController,
  monitorController,
  networkController,
  networkPolicyController,
  portalAuthDashboardController,
  portalConsumerAccessController,
  portalConsumerAccessListingController,
  portalConsumerAccessRequestController,
  portalConsumerGroupController,
  portalConsumerInviteController,
  portalConsumerProfileController,
  portalConsumerSurfaceProviderGroupController,
  portalController,
  providerAuthConfigController,
  providerAuthConfigErrorController,
  providerAuthConfigEventController,
  providerAuthCredentialsController,
  providerAuthExportController,
  providerAuthImportController,
  providerAuthMethodController,
  providerCategoryController,
  providerCollectionController,
  providerConfigController,
  providerConfigVaultController,
  providerController,
  providerDeploymentController,
  providerGroupController,
  providerInvocationController,
  providerListingController,
  providerRunController,
  providerSetupSessionController,
  providerSpecificationController,
  providerSpecificationChangeNotificationController,
  providerTemplateController,
  providerToolController,
  providerTriggerController,
  providerVersionController,
  protoGuardAlertController,
  protoGuardConfigController,
  publisherController,
  scmAccountsController,
  scmConnectionsController,
  scmInstallationController,
  scmProvidersController,
  scmReposController,
  sessionConnectionController,
  sessionController,
  sessionErrorController,
  sessionErrorGroupController,
  sessionEventController,
  sessionMessageController,
  sessionParticipantController,
  sessionProviderController,
  sessionTemplateController,
  sessionTemplateProviderController,
  skillAgentController,
  skillConfigurationController,
  skillController,
  skillExportController,
  skillForkSyncController,
  skillImportController,
  skillGroupController,
  skillGroupItemController,
  skillItemController,
  skillMarketplaceController,
  skillMarketplacePluginController,
  skillMarketplaceRepositoryController,
  skillMergeRequestController,
  skillMergeRequestCommentController,
  skillMergeRequestEventController,
  skillParticipantController,
  skillPluginController,
  skillPluginRepositoryController,
  skillPluginSkillController,
  skillSyncController,
  skillTemplateController,
  skillTemplateItemController,
  skillVersionController,
  storeController,
  storeItemController,
  storeParticipantController,
  tokenController,
  toolCallController
} from './instance';
import {
  accessPolicyManagementController,
  accessRoleManagementController,
  auditLogManagementController,
  cliDeviceManagementController,
  instanceManagementController,
  managementApiKeyController,
  oauthApplicationManagementController,
  oauthAuthorizationLogManagementController,
  oauthAuthorizationManagementController,
  oauthInstallationManagementController,
  oauthScopeManagementController,
  organizationInviteManagementController,
  organizationManagementController,
  organizationMemberManagementController,
  projectManagementController,
  sandboxManagementController,
  serviceAccountManagementController,
  teamManagementController
} from './management';
import { testHelperConsumerOAuthController } from './test-helpers';

let setControllerDocsMetadata = <
  T extends { descriptor: Record<string, any>; handlers: Record<string, any> }
>(
  controller: T,
  descriptor: Partial<T['descriptor']>
) => {
  Object.assign(controller.descriptor, descriptor);
  return controller;
};

[
  publisherController,
  providerController,
  providerCategoryController,
  providerCollectionController,
  providerGroupController,
  providerListingController,
  providerVersionController,
  providerSpecificationController,
  providerSpecificationChangeNotificationController,
  providerTriggerController,
  providerToolController,
  providerAuthMethodController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: providerDocsCategory
  })
);

[
  monitorController,
  monitorAlertController,
  protoGuardAlertController,
  protoGuardConfigController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: monitoringDocsCategory
  })
);

[
  customProviderController,
  customProviderCodeController,
  customProviderVersionController,
  customProviderDeploymentController,
  customProviderCommitController,
  customProviderEnvironmentController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: customProviderDocsCategory
  })
);

[
  sessionController,
  sessionTemplateController,
  sessionTemplateProviderController,
  sessionProviderController,
  sessionParticipantController,
  sessionMessageController,
  sessionConnectionController,
  sessionErrorController,
  sessionErrorGroupController,
  sessionEventController,
  toolCallController,
  providerRunController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: sessionDocsCategory
  })
);

[
  identityController,
  agentController,
  identityActorController,
  identityCredentialController,
  identityDelegationController,
  identityDelegationConfigController,
  identityDelegationRequestController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: identityDocsCategory
  })
);

[
  providerDeploymentController,
  providerConfigController,
  providerConfigVaultController,
  providerAuthConfigController,
  providerAuthConfigEventController,
  providerAuthConfigErrorController,
  providerAuthCredentialsController,
  providerSetupSessionController,
  providerAuthImportController,
  providerAuthExportController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: configurationDocsCategory
  })
);

[
  callbackController,
  callbackDestinationController,
  callbackEventController,
  callbackInstanceController,
  callbackNotificationController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: callbackDocsCategory
  })
);

[
  networkController,
  enclaveController,
  firewallController,
  firewallBindingController,
  networkPolicyController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: networkDocsCategory
  })
);

[
  integrationController,
  integrationProviderController,
  integrationSetupSessionController,
  integrationInstanceController,
  integrationInstanceProviderController,
  integrationInstanceGroupController,
  integrationInstanceGroupProviderController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: integrationDocsCategory
  })
);

[
  documentController,
  documentVersionController,
  documentParticipantController,
  storeController,
  storeItemController,
  storeParticipantController,
  fileController,
  fileLinkController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: fileCollectionDocsCategory
  })
);

[
  magicMcpEndpointController,
  magicMcpServerController,
  magicMcpSessionController,
  magicMcpTokenController,
  magicMcpGroupController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: magicMcpDocsCategory
  })
);

[
  portalController,
  portalAuthDashboardController,
  portalConsumerAccessController,
  portalConsumerAccessListingController,
  portalConsumerAccessRequestController,
  portalConsumerGroupController,
  portalConsumerProfileController,
  portalConsumerInviteController,
  providerTemplateController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: portalDocsCategory
  })
);

[
  skillConfigurationController,
  skillController,
  skillAgentController,
  skillGroupController,
  skillGroupItemController,
  skillItemController,
  skillParticipantController,
  skillTemplateController,
  skillTemplateItemController,
  skillVersionController,
  skillExportController,
  skillForkSyncController,
  skillImportController,
  skillMarketplaceController,
  skillMarketplacePluginController,
  skillMarketplaceRepositoryController,
  skillMergeRequestController,
  skillMergeRequestCommentController,
  skillMergeRequestEventController,
  skillPluginController,
  skillPluginRepositoryController,
  skillPluginSkillController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: skillDocsCategory
  })
);

export let magnetarController = Controller.create<any>(
  {
    name: 'Magnetar API',
    description: 'Magnetar API'
  },
  {
    instanceController,
    instancesController,

    tokenController,

    testHelperConsumerOAuthController,

    publisherController,
    providerController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    providerListingController,
    providerVersionController,
    providerSpecificationController,
    providerSpecificationChangeNotificationController,
    providerTriggerController,
    providerToolController,
    providerAuthMethodController,

    agentController,
    identityController,
    identityActorController,
    identityCredentialController,
    identityDelegationController,
    identityDelegationConfigController,
    identityDelegationRequestController,

    providerDeploymentController,
    providerConfigController,
    providerConfigVaultController,
    providerAuthConfigController,
    providerAuthCredentialsController,
    providerSetupSessionController,
    providerAuthImportController,
    providerAuthExportController,

    integrationController,
    integrationProviderController,
    integrationSetupSessionController,
    integrationInstanceController,
    integrationInstanceProviderController,
    integrationInstanceGroupController,
    integrationInstanceGroupProviderController,

    callbackController,
    callbackDestinationController,
    callbackEventController,
    callbackInstanceController,
    callbackNotificationController,

    networkController,
    enclaveController,
    firewallController,
    firewallBindingController,
    networkPolicyController,

    sessionController,
    sessionTemplateController,
    sessionTemplateProviderController,
    sessionProviderController,
    sessionParticipantController,
    sessionErrorController,
    sessionErrorGroupController,
    providerRunController,
    monitorController,
    monitorAlertController,
    protoGuardAlertController,
    protoGuardConfigController,
    sessionMessageController,
    sessionConnectionController,
    sessionEventController,

    toolCallController,

    magicMcpEndpointController,
    magicMcpServerController,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,

    customProviderController,
    customProviderVersionController,
    customProviderDeploymentController,
    customProviderCommitController,
    customProviderEnvironmentController,

    documentController,
    documentVersionController,
    documentParticipantController,
    storeController,
    storeItemController,
    storeParticipantController,
    fileController,
    fileLinkController,

    skillConfigurationController,
    skillController,
    skillAgentController,
    skillGroupController,
    skillGroupItemController,
    skillItemController,
    skillParticipantController,
    skillTemplateController,
    skillTemplateItemController,
    skillVersionController,
    skillExportController,
    skillForkSyncController,
    skillImportController,
    skillMarketplaceController,
    skillMarketplacePluginController,
    skillMergeRequestController,
    skillMergeRequestCommentController,
    skillMergeRequestEventController,
    skillPluginController,
    skillPluginSkillController,

    consumerSessionController,
    consumerProviderController,
    consumerActivityController,

    managementApiKeyController,
    dashboardAssistantController,

    consumerController,
    consumerSurfaceController,

    portalController,
    portalAuthDashboardController,
    portalConsumerAccessController,
    portalConsumerAccessListingController,
    portalConsumerAccessRequestController,
    portalConsumerGroupController,
    portalConsumerProfileController,
    portalConsumerInviteController,
    providerTemplateController

    // ssoTenantController,
    // ssoUserController,
    // ssoProfileController,
  }
);

export let consumerApiController = Controller.create<any>(
  {
    name: 'Consumer API',
    description: 'Consumer API'
  },
  {
    providerController,
    providerCategoryController,
    providerCollectionController,
    providerListingController,
    providerVersionController,
    providerSpecificationController,

    magicMcpEndpointController,
    magicMcpServerController,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,

    consumerSessionController,
    consumerProviderController,
    consumerActivityController,
    dashboardAssistantController
  }
);

export let dashboardController = Controller.create<any>(
  {
    name: 'Dashboard API',
    description: 'Dashboard API'
  },
  {
    dashboardOrganizationController,
    dashboardOrganizationConfigController,
    dashboardOrganizationInviteController,
    dashboardOrganizationLayoutController,
    dashboardProjectConfigurationController,
    dashboardKeyProviderController,
    dashboardResourceCountsController,
    dashboardAuthConfigConfigurationController,
    dashboardIntegrationNamingConfigurationController,
    dashboardToolCallingConfigurationController,
    dashboardOAuthAuthorizationRequestController,
    dashboardBootController,
    testHelperConsumerOAuthController,
    dashboardUsageController,
    dashboardAssistantController,
    flagsController,

    managementApiKeyController,

    instanceManagementController,
    organizationManagementController,
    auditLogManagementController,
    accessRoleManagementController,
    accessPolicyManagementController,
    oauthScopeManagementController,
    oauthApplicationManagementController,
    cliDeviceManagementController,
    oauthInstallationManagementController,
    oauthAuthorizationManagementController,
    oauthAuthorizationLogManagementController,
    serviceAccountManagementController,
    organizationInviteManagementController,
    organizationMemberManagementController,
    projectManagementController,
    sandboxManagementController,
    dashboardUserController,

    integrationController,
    integrationProviderController,
    integrationSetupSessionController,
    integrationInstanceController,
    integrationInstanceProviderController,
    integrationInstanceGroupController,
    integrationInstanceGroupProviderController,

    documentController,
    documentVersionController,
    documentParticipantController,
    storeController,
    storeItemController,
    storeParticipantController,
    fileController,
    fileLinkController,

    skillConfigurationController,
    skillController,
    skillAgentController,
    skillGroupController,
    skillGroupItemController,
    skillItemController,
    skillParticipantController,
    skillTemplateController,
    skillTemplateItemController,
    skillVersionController,
    skillExportController,
    skillForkSyncController,
    skillImportController,
    skillMarketplaceController,
    skillMarketplacePluginController,
    skillMarketplaceRepositoryController,
    skillMergeRequestController,
    skillMergeRequestCommentController,
    skillMergeRequestEventController,
    skillPluginController,
    skillPluginRepositoryController,
    skillPluginSkillController,
    skillSyncController,

    consumerController,
    consumerSurfaceController,
    sessionController,

    profileController,

    teamManagementController,

    providerController,
    agentController,
    identityController,
    identityActorController,
    identityCredentialController,
    identityDelegationController,
    identityDelegationConfigController,
    identityDelegationRequestController,
    providerListingController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    publisherController,

    providerSetupSessionController,

    providerVersionController,
    providerSpecificationController,
    providerSpecificationChangeNotificationController,
    providerTriggerController,
    providerToolController,
    providerAuthMethodController,

    providerDeploymentController,
    providerConfigController,
    providerConfigVaultController,
    providerAuthConfigController,
    providerAuthConfigEventController,
    providerAuthConfigErrorController,
    providerAuthCredentialsController,
    providerInvocationController,

    providerAuthImportController,
    providerAuthExportController,

    callbackController,
    callbackDestinationController,
    callbackEventController,
    callbackInstanceController,
    callbackNotificationController,

    networkController,
    dashboardEnclaveController,
    enclaveController,
    firewallController,
    firewallBindingController,
    networkPolicyController,

    sessionTemplateController,
    sessionTemplateProviderController,
    sessionProviderController,
    sessionParticipantController,
    sessionErrorController,
    sessionErrorGroupController,
    providerRunController: providerRunController,
    monitorController,
    monitorAlertController,
    protoGuardAlertController,
    protoGuardConfigController,
    sessionMessageController,
    sessionConnectionController,
    sessionEventController,

    toolCallController,

    magicMcpEndpointController,
    magicMcpServerControllerDashboard,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,

    customProviderController,
    customProviderCodeController,
    customProviderVersionController,
    customProviderDeploymentController,
    customProviderCommitController,
    customProviderEnvironmentController,

    scmConnectionsController,
    scmProvidersController,
    scmInstallationController,
    scmReposController,
    scmAccountsController,

    portalController,
    portalAuthDashboardController,
    providerTemplateController,
    portalConsumerGroupController,
    portalConsumerSurfaceProviderGroupController,
    portalConsumerAccessController,
    portalConsumerAccessListingController,
    portalConsumerInviteController,
    portalConsumerProfileController,
    portalConsumerAccessRequestController

    // ssoTenantController,
    // ssoUserController,
    // ssoProfileController,

    // portalConsumerGroupController,
    // portalConsumerAccessController,
    // portalConsumerProfileController,
    // portalConsumerAuthFactorController,
    // portalConsumerServerRequestController,
    // portalFeaturedServersController,
  }
);

export let fullDashboardController = Controller.create<any>(dashboardController.descriptor, {
  ...dashboardController.handlers,

  dashboardOrganizationController,
  dashboardOrganizationConfigController,
  dashboardOrganizationInviteController,
  dashboardOrganizationLayoutController,
  dashboardProjectConfigurationController,
  dashboardKeyProviderController,
  dashboardAuthConfigConfigurationController,
  dashboardIntegrationNamingConfigurationController,
  dashboardToolCallingConfigurationController,
  dashboardOAuthAuthorizationRequestController,
  dashboardBootController,
  testHelperConsumerOAuthController,
  dashboardUserController
});
