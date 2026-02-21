import { Controller } from '@metorial/rest';
import { dashboardApiKeyController } from './dashboard/apiKey';
import { dashboardBootController } from './dashboard/boot';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { profileController } from './dashboard/profile';
import { dashboardUsageController } from './dashboard/usage';
import { dashboardUserController } from './dashboard/user';
import { fileController } from './instance/file';
import { fileLinkController } from './instance/fileLink';
import { instanceController } from './instance/instance';
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
  providerPublisherController,
  providerSessionController,
  providerSetupSessionController,
  providerSetupSessionDashboardController,
  providerSpecificationController,
  providerToolController,
  providerVersionController,
  sessionTemplateController,
  sessionTemplateProviderController,
  subspaceProviderRunController,
  subspaceSessionConnectionController,
  subspaceSessionErrorController,
  subspaceSessionErrorGroupController,
  subspaceSessionEventController,
  subspaceSessionMessageController,
  subspaceSessionParticipantController,
  subspaceSessionProviderController
} from './provider';
import { scmAccountsController, scmInstallationController, scmReposController } from './scm';

export let magnetarController = Controller.create<any>(
  {
    name: 'Magnetar API',
    description: 'Magnetar API'
  },
  {
    instanceController,

    providerPublisherController,
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

    providerSessionController,
    sessionTemplateController,
    sessionTemplateProviderController,
    subspaceSessionProviderController,
    subspaceSessionParticipantController,
    subspaceSessionErrorController,
    subspaceSessionErrorGroupController,
    subspaceProviderRunController,
    subspaceSessionMessageController,
    subspaceSessionConnectionController,
    subspaceSessionEventController,

    customProviderController,
    customProviderCodeController,
    customProviderVersionController,
    customProviderDeploymentController,
    customProviderCommitController,
    customProviderEnvironmentController,

    scmInstallationController,
    scmReposController,
    scmAccountsController,

    fileController,
    fileLinkController,

    teamManagementController,
    teamRoleManagementController,
    teamRolePermissionsManagementController

    // magicMcpServerController,
    // magicMcpSessionController,
    // magicMcpTokenController,
    // magicMcpGroupController,

    // portalController,
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

    providerSessionController,

    profileController,

    teamRolePermissionsManagementController,
    teamRoleManagementController,
    teamManagementController,

    providerController,
    providerListingController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    providerPublisherController,
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
    subspaceSessionProviderController,
    subspaceSessionParticipantController,
    subspaceSessionErrorController,
    subspaceSessionErrorGroupController,
    subspaceProviderRunController,
    subspaceSessionMessageController,
    subspaceSessionConnectionController,
    subspaceSessionEventController,

    customProviderController,
    customProviderCodeController,
    customProviderVersionController,
    customProviderDeploymentController,
    customProviderCommitController,
    customProviderEnvironmentController,

    scmInstallationController,
    scmReposController,
    scmAccountsController

    // callbackController,
    // callbackEventController,
    // callbackDestinationController,
    // callbackNotificationController,

    // ssoTenantController,
    // ssoUserController,
    // ssoProfileController,

    // portalController,
    // portalConsumerGroupController,
    // portalConsumerAccessController,
    // portalConsumerProfileController,
    // portalConsumerAuthFactorController,
    // portalConsumerServerRequestController,
    // portalFeaturedServersController,

    // magicMcpServerController,
    // magicMcpSessionController,
    // magicMcpTokenController,
    // magicMcpGroupController,
  }
);

export let fullDashboardController = Controller.create<any>(dashboardController.descriptor, {
  ...dashboardController.handlers,

  dashboardOrganizationController,
  dashboardOrganizationInviteController,
  dashboardBootController,
  dashboardUserController
});
