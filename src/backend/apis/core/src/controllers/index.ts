import { Controller } from '@metorial/rest';
import { dashboardApiKeyController } from './dashboard/apiKey';
import { dashboardBootController } from './dashboard/boot';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { profileController } from './dashboard/profile';
import { dashboardUsageController } from './dashboard/usage';
import { dashboardUserController } from './dashboard/user';
import { consumerProviderController } from './consumer/provider';
import { consumerSessionController } from './consumer/session';
import { fileController } from './instance/file';
import { fileLinkController } from './instance/fileLink';
import { instanceController } from './instance/instance';
import { portalAuthDashboardController } from './instance/portalAuth';
import { portalConsumerAccessController } from './instance/portalConsumerAccess';
import { portalConsumerAccessRequestController } from './instance/portalConsumerAccessRequest';
import { portalConsumerGroupController } from './instance/portalConsumerGroup';
import { portalConsumerProfileController } from './instance/portalConsumerProfile';
import { portalController } from './instance/portal';
import { providerTemplateController } from './instance/providerTemplate';
import { instanceManagementController } from './management/instance';
import { organizationManagementController } from './management/organization';
import { organizationInviteManagementController } from './management/organizationInvite';
import { organizationMemberManagementController } from './management/organizationMember';
import { projectManagementController } from './management/project';
import { teamManagementController } from './management/team';
import { teamRoleManagementController } from './management/teamRole';
import { teamRolePermissionsManagementController } from './management/teamRolePermissions';
import {
  customProviderCodeController,
  customProviderCommitController,
  customProviderController,
  customProviderDeploymentController,
  customProviderEnvironmentController,
  customProviderVersionController,
  magicMcpGroupController,
  magicMcpServerController,
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
import { scmAccountsController, scmInstallationController, scmReposController } from './scm';

export let magnetarController = Controller.create<any>(
  {
    name: 'Magnetar API',
    description: 'Magnetar API'
  },
  {
    instanceController,

    publisherController,
    providerController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    providerListingController,

    providerVersionController,
    providerSpecificationController,
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

    portalController,
    providerTemplateController,

    consumerSessionController,
    consumerProviderController,

    // teamManagementController,
    // teamRoleManagementController,
    // teamRolePermissionsManagementController

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
    dashboardBootController,
    dashboardApiKeyController,
    dashboardUsageController,

    instanceManagementController,
    organizationManagementController,
    organizationInviteManagementController,
    organizationMemberManagementController,
    projectManagementController,
    dashboardUserController,

    fileController,
    fileLinkController,

    sessionController,

    profileController,

    teamRolePermissionsManagementController,
    teamRoleManagementController,
    teamManagementController,

    providerController,
    providerListingController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    publisherController,

    providerVersionController,
    providerSpecificationController,
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

    customProviderController,
    customProviderCodeController,
    customProviderVersionController,
    customProviderDeploymentController,
    customProviderCommitController,
    customProviderEnvironmentController,

    scmInstallationController,
    scmReposController,
    scmAccountsController,

    portalController,
    portalAuthDashboardController,
    providerTemplateController,
    portalConsumerGroupController,
    portalConsumerAccessController,
    portalConsumerProfileController,
    portalConsumerAccessRequestController,

    // callbackController,
    // callbackEventController,
    // callbackDestinationController,
    // callbackNotificationController,

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
  dashboardBootController,
  dashboardUserController
});
