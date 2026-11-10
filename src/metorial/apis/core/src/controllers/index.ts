import { checkEdition } from '@metorial/editions';
import { Controller } from '@metorial/rest';
import {
  callbackDocsCategory,
  chatDocsCategory,
  configurationDocsCategory,
  customProviderDocsCategory,
  fileCollectionDocsCategory,
  identityDocsCategory,
  integrationDocsCategory,
  integrationNetworkDocsCategory,
  magicMcpDocsCategory,
  monitoringDocsCategory,
  networkDocsCategory,
  portalDocsCategory,
  providerDocsCategory,
  sandboxDocsCategory,
  sessionDocsCategory,
  skillDocsCategory
} from './_categories';
import {
  consumerActivityController,
  consumerOAuthAuthorizationController,
  consumerProviderController,
  consumerSessionController
} from './consumer';
import {
  dashboardAiAnalysisConfigurationController,
  dashboardAssistantController,
  dashboardAuditLogRetentionController,
  dashboardAuthConfigConfigurationController,
  dashboardBootController,
  dashboardDataRetentionConfigurationController,
  dashboardInstanceUsageController,
  dashboardIntegrationNamingConfigurationController,
  dashboardKeyProviderController,
  dashboardOAuthAuthorizationRequestController,
  dashboardOrganizationConfigController,
  dashboardOrganizationController,
  dashboardOrganizationInviteController,
  dashboardOrganizationLayoutController,
  dashboardOwnershipAccessController,
  dashboardProjectConfigurationController,
  dashboardProjectSkillSyncConfigurationController,
  dashboardResourceCountsController,
  dashboardResourceOwnershipConfigurationController,
  dashboardSessionlessMcpConfigurationController,
  dashboardToolCallingConfigurationController,
  dashboardUsageController,
  dashboardUserController,
  dashboardWorkforceConfigurationController,
  flagsController,
  profileController,
  scopesController
} from './dashboard';
import {
  agentController,
  callbackController,
  callbackEventController,
  callbackInstanceController,
  chatChannelController,
  chatConnectionController,
  chatController,
  chatDmController,
  chatEventController,
  chatInstanceController,
  chatMessageController,
  chatThreadController,
  chatWorkspaceController,
  consumerController,
  consumerSurfaceController,
  customProviderCodeController,
  customProviderCommitController,
  customProviderController,
  customProviderDeploymentController,
  customProviderEnvironmentController,
  customProviderVersionController,
  dashboardIntegrationEnclaveController,
  documentCommentController,
  documentCommentThreadController,
  documentController,
  documentParticipantController,
  documentVersionController,
  fileController,
  fileLinkController,
  firewallController,
  identityActorController,
  identityController,
  identityCredentialController,
  identityDelegationConfigController,
  identityDelegationController,
  identityDelegationRequestController,
  incomingWebhookController,
  instanceController,
  instancesController,
  integrationController,
  integrationEnclaveController,
  integrationFirewallAssignmentController,
  integrationInstanceController,
  integrationInstanceGroupController,
  integrationInstanceGroupProviderController,
  integrationInstanceProviderController,
  integrationInternetGatewayController,
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
  networkPolicyController,
  portalConsumerAccessController,
  portalConsumerAccessListingController,
  portalConsumerAccessRequestController,
  portalConsumerGroupController,
  portalConsumerInviteController,
  portalConsumerProfileController,
  portalConsumerSurfaceProviderGroupController,
  portalController,
  protoGuardAlertController,
  protoGuardConfigController,
  protoGuardSuppressionController,
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
  providerSecurityReviewController,
  providerSetupSessionController,
  providerSpecificationChangeNotificationController,
  providerSpecificationController,
  providerIssueController,
  providerTemplateController,
  providerToolController,
  providerTriggerController,
  providerVersionController,
  publicMcpServerController,
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
  skillAccessController,
  skillAgentController,
  skillConfigurationController,
  skillContentPreviewController,
  skillController,
  skillExportController,
  skillFileController,
  skillForkSyncController,
  skillGroupController,
  skillGroupItemController,
  skillImportController,
  skillItemController,
  skillMarketplaceController,
  skillMarketplacePluginController,
  skillMarketplaceRepositoryController,
  skillMergeRequestCommentController,
  skillMergeRequestController,
  skillMergeRequestEventController,
  skillParticipantController,
  skillPluginController,
  skillPluginRepositoryController,
  skillPluginSkillController,
  skillSecurityReviewController,
  skillSyncController,
  skillTemplateController,
  skillTemplateItemController,
  skillVersionController,
  storeController,
  storeItemController,
  storeParticipantController,
  tokenController,
  toolCallController,
  webhookRegistrationController
} from './instance';
import {
  accessPolicyManagementController,
  accessRoleManagementController,
  auditLogManagementController,
  auditLogStreamEventManagementController,
  auditLogStreamManagementController,
  cliDeviceManagementController,
  eventDeliveryAttemptManagementController,
  eventDeliveryManagementController,
  eventDestinationListenerController,
  eventDestinationManagementController,
  eventManagementController,
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
  outpostManagementController,
  projectManagementController,
  sandboxManagementController,
  serviceAccountManagementController,
  teamManagementController
} from './management';
import { testHelperConsumerOAuthController } from './test-helpers';

let onPremScmControllers = checkEdition('on-prem')
  ? await import('./instance/scm/providerOptions')
  : ({} as typeof import('./instance/scm/providerOptions'));

let sandboxControllers = checkEdition('cloud')
  ? await import('./instance/sandbox/controllers')
  : ({} as typeof import('./instance/sandbox/controllers'));

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
  providerSecurityReviewController,
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
  providerIssueController,
  monitorController,
  monitorAlertController,
  protoGuardAlertController,
  protoGuardConfigController,
  protoGuardSuppressionController
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

[firewallController, networkPolicyController].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: networkDocsCategory
  })
);

Object.values(sandboxControllers).forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: sandboxDocsCategory
  })
);

[
  integrationInternetGatewayController,
  integrationEnclaveController,
  integrationFirewallAssignmentController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: integrationNetworkDocsCategory
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
  callbackController,
  callbackEventController,
  callbackInstanceController,
  webhookRegistrationController,
  incomingWebhookController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: callbackDocsCategory
  })
);

[
  chatConnectionController,
  chatInstanceController,
  chatWorkspaceController,
  chatEventController,
  chatController,
  chatChannelController,
  chatThreadController,
  chatMessageController,
  chatDmController
].forEach(controller =>
  setControllerDocsMetadata(controller, {
    category: chatDocsCategory
  })
);

[
  documentController,
  documentVersionController,
  documentParticipantController,
  documentCommentThreadController,
  documentCommentController,
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
  skillFileController,
  skillGroupController,
  skillGroupItemController,
  skillItemController,
  skillAccessController,
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
  skillSecurityReviewController,
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
    callbackEventController,
    callbackInstanceController,

    chatConnectionController,
    chatInstanceController,
    chatWorkspaceController,
    chatEventController,
    chatController,
    chatChannelController,
    chatThreadController,
    chatMessageController,
    chatDmController,

    eventDestinationManagementController,
    eventDestinationListenerController,
    eventManagementController,
    eventDeliveryManagementController,
    eventDeliveryAttemptManagementController,

    integrationInternetGatewayController,
    integrationEnclaveController,
    firewallController,
    integrationFirewallAssignmentController,
    networkPolicyController,

    ...sandboxControllers,

    sessionController,
    sessionTemplateController,
    sessionTemplateProviderController,
    sessionProviderController,
    sessionParticipantController,
    sessionErrorController,
    sessionErrorGroupController,
    providerIssueController,
    providerRunController,
    monitorController,
    monitorAlertController,
    protoGuardAlertController,
    protoGuardConfigController,
    protoGuardSuppressionController,
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
    documentCommentThreadController,
    documentCommentController,
    storeController,
    storeItemController,
    storeParticipantController,
    fileController,
    fileLinkController,

    skillConfigurationController,
    skillController,
    skillAgentController,
    skillFileController,
    skillGroupController,
    skillGroupItemController,
    skillItemController,
    skillAccessController,
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
    skillSecurityReviewController,
    skillPluginController,
    skillPluginSkillController,

    consumerSessionController,
    consumerProviderController,
    consumerActivityController,
    consumerOAuthAuthorizationController,

    managementApiKeyController,
    outpostManagementController,
    dashboardAssistantController,

    consumerController,
    consumerSurfaceController,

    portalController,
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
    consumerOAuthAuthorizationController,
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
    dashboardAuditLogRetentionController,
    dashboardOrganizationConfigController,
    dashboardOrganizationInviteController,
    dashboardOrganizationLayoutController,
    dashboardProjectConfigurationController,
    dashboardProjectSkillSyncConfigurationController,
    dashboardKeyProviderController,
    dashboardResourceCountsController,
    dashboardOwnershipAccessController,
    dashboardAuthConfigConfigurationController,
    dashboardIntegrationNamingConfigurationController,
    dashboardToolCallingConfigurationController,
    dashboardSessionlessMcpConfigurationController,
    dashboardAiAnalysisConfigurationController,
    dashboardDataRetentionConfigurationController,
    dashboardResourceOwnershipConfigurationController,
    dashboardOAuthAuthorizationRequestController,
    dashboardBootController,
    testHelperConsumerOAuthController,
    dashboardUsageController,
    dashboardInstanceUsageController,
    dashboardAssistantController,
    dashboardWorkforceConfigurationController,
    flagsController,
    scopesController,

    managementApiKeyController,

    instanceManagementController,
    organizationManagementController,
    auditLogManagementController,
    auditLogStreamManagementController,
    auditLogStreamEventManagementController,
    eventDestinationManagementController,
    eventManagementController,
    eventDeliveryManagementController,
    eventDeliveryAttemptManagementController,
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
    outpostManagementController,
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

    callbackController,
    callbackEventController,
    callbackInstanceController,
    webhookRegistrationController,
    incomingWebhookController,
    eventDestinationListenerController,

    chatConnectionController,
    chatInstanceController,
    chatWorkspaceController,
    chatEventController,
    chatController,
    chatChannelController,
    chatThreadController,
    chatMessageController,
    chatDmController,

    documentController,
    documentVersionController,
    documentParticipantController,
    documentCommentThreadController,
    documentCommentController,
    storeController,
    storeItemController,
    storeParticipantController,
    fileController,
    fileLinkController,

    skillConfigurationController,
    skillController,
    skillAgentController,
    skillFileController,
    skillGroupController,
    skillGroupItemController,
    skillItemController,
    skillAccessController,
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
    skillSecurityReviewController,
    skillPluginController,
    skillPluginRepositoryController,
    skillPluginSkillController,
    skillContentPreviewController,
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
    providerSecurityReviewController,
    providerSpecificationController,
    providerSpecificationChangeNotificationController,
    providerTriggerController,
    providerToolController,
    providerAuthMethodController,

    providerDeploymentController,
    providerConfigController,
    providerConfigVaultController,
    publicMcpServerController,
    providerAuthConfigController,
    providerAuthConfigEventController,
    providerAuthConfigErrorController,
    providerAuthCredentialsController,
    providerInvocationController,

    providerAuthImportController,
    providerAuthExportController,

    integrationInternetGatewayController,
    dashboardIntegrationEnclaveController,
    integrationEnclaveController,
    firewallController,
    integrationFirewallAssignmentController,
    networkPolicyController,

    ...sandboxControllers,

    sessionTemplateController,
    sessionTemplateProviderController,
    sessionProviderController,
    sessionParticipantController,
    sessionErrorController,
    sessionErrorGroupController,
    providerIssueController,
    providerRunController: providerRunController,
    monitorController,
    monitorAlertController,
    protoGuardAlertController,
    protoGuardConfigController,
    protoGuardSuppressionController,
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
    ...onPremScmControllers,
    scmInstallationController,
    scmReposController,
    scmAccountsController,

    portalController,
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
  dashboardProjectSkillSyncConfigurationController,
  dashboardKeyProviderController,
  dashboardAuthConfigConfigurationController,
  dashboardIntegrationNamingConfigurationController,
  dashboardToolCallingConfigurationController,
  dashboardSessionlessMcpConfigurationController,
  dashboardAiAnalysisConfigurationController,
  dashboardDataRetentionConfigurationController,
  dashboardResourceOwnershipConfigurationController,
  dashboardOAuthAuthorizationRequestController,
  dashboardBootController,
  testHelperConsumerOAuthController,
  dashboardUserController
});
