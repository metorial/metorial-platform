import { Controller } from '@metorial/rest';
import {
  callbackDocsCategory,
  configurationDocsCategory,
  customProviderDocsCategory,
  fileCollectionDocsCategory,
  identityDocsCategory,
  integrationDocsCategory,
  portalDocsCategory,
  providerDocsCategory,
  sessionDocsCategory
} from './_categories';
import { consumerProviderController, consumerSessionController } from './consumer';
import {
  dashboardAssistantController,
  dashboardBootController,
  dashboardOAuthAuthorizationRequestController,
  dashboardOrganizationController,
  dashboardOrganizationInviteController,
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
  documentController,
  documentParticipantController,
  documentVersionController,
  fileController,
  fileLinkController,
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
  providerTemplateController,
  providerToolController,
  providerTriggerController,
  providerVersionController,
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
  skillController,
  skillGroupController,
  skillGroupItemController,
  skillItemController,
  skillTemplateController,
  skillTemplateItemController,
  storeController,
  storeItemController,
  storeParticipantController,
  tokenController,
  toolCallController
} from './instance';
import {
  accessPolicyManagementController,
  accessRoleManagementController,
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
  serviceAccountManagementController,
  teamManagementController
} from './management';

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
  providerTriggerController,
  providerToolController,
  providerAuthMethodController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: providerDocsCategory
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
  portalController,
  portalAuthDashboardController,
  portalConsumerAccessController,
  portalConsumerAccessListingController,
  portalConsumerAccessRequestController,
  portalConsumerGroupController,
  portalConsumerProfileController,
  portalConsumerInviteController,
  portalConsumerSurfaceProviderGroupController,
  providerTemplateController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: portalDocsCategory
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

    publisherController,
    providerController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    providerListingController,
    providerVersionController,
    providerSpecificationController,
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

    sessionController,
    sessionTemplateController,
    sessionTemplateProviderController,
    sessionProviderController,
    sessionParticipantController,
    sessionErrorController,
    sessionErrorGroupController,
    providerRunController,
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

    skillController,
    skillGroupController,
    skillGroupItemController,
    skillItemController,
    skillTemplateController,
    skillTemplateItemController,

    consumerController,
    consumerSurfaceController,
    portalController,
    providerTemplateController,

    consumerSessionController,
    consumerProviderController,

    managementApiKeyController,
    dashboardAssistantController

    // teamManagementController,
    // portalConsumerGroupController,
    // portalConsumerAccessController,
    // portalConsumerProfileController,
    // portalConsumerAuthFactorController,
    // consumerSessionController,

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
    dashboardOrganizationInviteController,
    dashboardOAuthAuthorizationRequestController,
    dashboardBootController,
    dashboardUsageController,
    dashboardAssistantController,
    flagsController,

    managementApiKeyController,

    instanceManagementController,
    organizationManagementController,
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

    skillController,
    skillGroupController,
    skillGroupItemController,
    skillItemController,
    skillTemplateController,
    skillTemplateItemController,

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

    sessionTemplateController,
    sessionTemplateProviderController,
    sessionProviderController,
    sessionParticipantController,
    sessionErrorController,
    sessionErrorGroupController,
    providerRunController: providerRunController,
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
  dashboardOrganizationInviteController,
  dashboardOAuthAuthorizationRequestController,
  dashboardBootController,
  dashboardUserController
});
