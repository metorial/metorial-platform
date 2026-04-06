import { Controller } from '@metorial/rest';
import { consumerProviderController } from './consumer/provider';
import { consumerSessionController } from './consumer/session';
import { dashboardBootController } from './dashboard/boot';
import { flagsController } from './dashboard/flags';
import { dashboardOAuthAuthorizationRequestController } from './dashboard/oauthAuthorizationRequest';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { profileController } from './dashboard/profile';
import { dashboardUsageController } from './dashboard/usage';
import { dashboardUserController } from './dashboard/user';
import { consumerController } from './instance/consumer';
import { consumerSurfaceController } from './instance/consumerSurface';
import { fileController } from './instance/file';
import { fileLinkController } from './instance/fileLink';
import { instanceController } from './instance/instance';
import { instancesController } from './instance/instances';
import { portalController } from './instance/portal';
import { portalAuthDashboardController } from './instance/portalAuth';
import { portalConsumerAccessController } from './instance/portalConsumerAccess';
import { portalConsumerAccessRequestController } from './instance/portalConsumerAccessRequest';
import { portalConsumerGroupController } from './instance/portalConsumerGroup';
import { portalConsumerProfileController } from './instance/portalConsumerProfile';
import { providerTemplateController } from './instance/providerTemplate';
import { tokenController } from './instance/token';
import { accessPolicyManagementController } from './management/accessPolicy';
import { accessRoleManagementController } from './management/accessRole';
import { managementApiKeyController } from './management/apiKey';
import { cliDeviceManagementController } from './management/cliDevice';
import { instanceManagementController } from './management/instance';
import { oauthApplicationManagementController } from './management/oauthApplication';
import { oauthAuthorizationManagementController } from './management/oauthAuthorization';
import { oauthAuthorizationLogManagementController } from './management/oauthAuthorizationLog';
import { oauthInstallationManagementController } from './management/oauthInstallation';
import { oauthScopeManagementController } from './management/oauthScope';
import { organizationManagementController } from './management/organization';
import { organizationInviteManagementController } from './management/organizationInvite';
import { organizationMemberManagementController } from './management/organizationMember';
import { projectManagementController } from './management/project';
import { serviceAccountManagementController } from './management/serviceAccount';
import { teamManagementController } from './management/team';
import {
  callbackController,
  callbackDestinationController,
  callbackEventController,
  callbackInstanceController,
  callbackNotificationController,
  customProviderCodeController,
  customProviderCommitController,
  customProviderController,
  customProviderDeploymentController,
  customProviderEnvironmentController,
  customProviderVersionController,
  identityActorController,
  identityController,
  identityCredentialController,
  identityDelegationConfigController,
  identityDelegationController,
  identityDelegationRequestController,
  magicMcpGroupController,
  magicMcpServerController,
  magicMcpServerProviderController,
  magicMcpSessionController,
  magicMcpTokenController,
  providerAuthConfigController,
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
  providerListingController,
  providerRunController,
  providerSetupSessionController,
  providerSetupSessionDashboardController,
  providerSpecificationController,
  providerToolController,
  providerTriggerController,
  providerVersionController,
  publisherController,
  sessionConnectionController,
  sessionController,
  sessionErrorController,
  sessionErrorGroupController,
  sessionEventController,
  sessionMessageController,
  sessionParticipantController,
  sessionProviderController,
  sessionTemplateController,
  sessionTemplateProviderController
} from './provider';
import { toolCallController } from './provider/toolCall';
import {
  scmAccountsController,
  scmConnectionsController,
  scmInstallationController,
  scmProvidersController,
  scmReposController
} from './scm';

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
    identityController,
    identityActorController,
    identityCredentialController,
    identityDelegationController,
    identityDelegationConfigController,
    identityDelegationRequestController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    providerListingController,

    providerVersionController,
    providerSpecificationController,
    providerTriggerController,
    providerToolController,
    providerAuthMethodController,

    providerDeploymentController,
    providerConfigController,
    providerConfigVaultController,

    providerAuthConfigController,
    providerAuthCredentialsController,
    providerSetupSessionController,
    providerAuthImportController,
    providerAuthExportController,

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

    magicMcpServerController,
    magicMcpServerProviderController,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,

    customProviderController,
    customProviderVersionController,
    customProviderDeploymentController,
    customProviderCommitController,
    customProviderEnvironmentController,

    fileController,
    fileLinkController,

    consumerController,
    consumerSurfaceController,
    portalController,
    providerTemplateController,

    consumerSessionController,
    consumerProviderController,

    managementApiKeyController

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

    fileController,
    fileLinkController,

    consumerController,
    consumerSurfaceController,
    sessionController,

    profileController,

    teamManagementController,

    providerController,
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

    providerVersionController,
    providerSpecificationController,
    providerTriggerController,
    providerToolController,
    providerAuthMethodController,

    providerDeploymentController,
    providerConfigController,
    providerConfigVaultController,
    providerAuthConfigController,
    providerAuthCredentialsController,
    providerSetupSessionDashboardController,

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

    magicMcpServerController,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,
    magicMcpServerProviderController,

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
    portalConsumerAccessController,
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
