import { Controller } from '@metorial/rest';
import { consumerServerController } from './consumer/server';
import { consumerSessionController } from './consumer/session';
import { dashboardApiKeyController } from './dashboard/apiKey';
import { dashboardBootController } from './dashboard/boot';
import { dashboardManagedServerTemplateController } from './dashboard/managedServerTemplate';
import { dashboardOauthConnectionTemplateController } from './dashboard/oauthConnectionTemplate';
import { dashboardOauthDiscoveryController } from './dashboard/oauthDiscovery';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { profileController } from './dashboard/profile';
import { dashboardRepoController } from './dashboard/repo';
import { dashboardUsageController } from './dashboard/usage';
import { dashboardUserController } from './dashboard/user';

import {
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
  providerSetupSessionController,
  providerAuthImportController,
  providerAuthExportController,
  sessionTemplateController,
  sessionTemplateProviderController,
  providerSessionController,
  subspaceSessionProviderController,
  subspaceSessionParticipantController,
  subspaceSessionErrorController,
  subspaceSessionErrorGroupController,
  subspaceProviderRunController
} from './provider';
import { callbackController } from './instance/callback';
import { callbackDestinationController } from './instance/callbackDestination';
import { callbackEventController } from './instance/callbackEvent';
import { callbackNotificationController } from './instance/callbackNotification';
import { customServerController } from './instance/customServer';
import { customServerCodeController } from './instance/customServerCode';
import { customServerDeploymentController } from './instance/customServerDeployment';
import { customServerEventController } from './instance/customServerEvent';
import { customServerVersionController } from './instance/customServerVersion';
import { fileController } from './instance/file';
import { fileLinkController } from './instance/fileLink';
import { instanceController } from './instance/instance';
import { magicMcpGroupController } from './instance/magicMcpGroup';
import { magicMcpServerController } from './instance/magicMcpServer';
import { magicMcpSessionController } from './instance/magicMcpSession';
import { magicMcpTokenController } from './instance/magicMcpToken';
import { portalController } from './instance/portal';
import { portalConsumerAuthFactorController } from './instance/portalAuthFactors';
import { portalConsumerAccessController } from './instance/portalConsumerAccess';
import { portalConsumerGroupController } from './instance/portalConsumerGroup';
import { portalConsumerProfileController } from './instance/portalConsumerProfile';
import { portalConsumerServerRequestController } from './instance/portalConsumerServerRequest';
import { portalFeaturedServersController } from './instance/portalFeaturedServers';
import { providerOauthConnectionController } from './instance/providerOauthConnection';
import { providerOauthConnectionAuthenticationController } from './instance/providerOauthConnectionAuthentication';
import { providerOauthConnectionEventController } from './instance/providerOauthConnectionEvent';
import { providerOauthConnectionProfileController } from './instance/providerOauthConnectionProfile';
import { providerOauthTakeoutController } from './instance/providerOauthExport';
import { providerOauthTakeInController } from './instance/providerOauthImport';
import { remoteServerController } from './instance/remoteServer';
import { secretController } from './instance/secret';
import { serverController } from './instance/server';
import { serverCapabilitiesController } from './instance/serverCapabilities';
import { serverConfigVaultController } from './instance/serverConfigVault';
import { serverDeploymentController } from './instance/serverDeployment';
import { serverDeploymentTemplateController } from './instance/serverDeploymentTemplate';
import { serverImplementationController } from './instance/serverImplementation';
import { serverListingController } from './instance/serverListing';
import { serverListingCategoryController } from './instance/serverListingCategory';
import { serverListingCollectionController } from './instance/serverListingCollection';
import { serverOauthSessionController } from './instance/serverOAuthSession';
import { serverRunController } from './instance/serverRun';
import { serverRunErrorController } from './instance/serverRunError';
import { serverRunErrorGroupController } from './instance/serverRunErrorGroup';
import { serverSessionController } from './instance/serverSession';
import { serverVariantController } from './instance/serverVariant';
import { serverVersionController } from './instance/serverVersion';
import { sessionController } from './instance/session';
import { sessionConnectionController } from './instance/sessionConnection';
import { sessionEventController } from './instance/sessionEvent';
import { sessionMessageController } from './instance/sessionMessage';
import { ssoProfileController } from './instance/ssoProfile';
import { ssoTenantController } from './instance/ssoTenant';
import { ssoUserController } from './instance/ssoUser';
import { instanceManagementController } from './management/instance';
import { organizationManagementController } from './management/organization';
import { organizationInviteManagementController } from './management/organizationInvite';
import { organizationMemberManagementController } from './management/organizationMember';
import { projectManagementController } from './management/project';
import { teamManagementController } from './management/team';
import { teamRoleManagementController } from './management/teamRole';
import { teamRolePermissionsManagementController } from './management/teamRolePermissions';

export let pulsarController = Controller.create<any>(
  {
    name: 'Pulsar API',
    description: 'Pulsar API'
  },
  {
    instanceController,

    fileController,
    fileLinkController,

    secretController,

    serverController,
    serverVariantController,
    serverVersionController,
    serverListingController,
    serverListingCategoryController,
    serverListingCollectionController,

    serverImplementationController,
    serverDeploymentController,
    serverDeploymentTemplateController,

    sessionController,
    sessionEventController,
    sessionMessageController,

    serverRunController,
    serverRunErrorController,

    sessionConnectionController,

    serverCapabilitiesController,

    providerOauthConnectionController,
    providerOauthConnectionAuthenticationController,
    providerOauthConnectionProfileController,
    providerOauthTakeoutController,
    providerOauthTakeInController,

    serverOauthSessionController,

    magicMcpServerController,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,

    callbackController,
    callbackEventController,
    callbackDestinationController,
    callbackNotificationController,

    customServerController,
    customServerVersionController,
    customServerDeploymentController,

    serverConfigVaultController,
    teamRolePermissionsManagementController,
    teamRoleManagementController,
    teamManagementController,

    ssoTenantController,
    ssoUserController,
    ssoProfileController,

    portalController,
    portalConsumerGroupController,
    portalConsumerAccessController,
    portalConsumerProfileController,
    portalConsumerAuthFactorController,

    consumerSessionController,
    consumerServerController

    // consumerMagicMcpGroupController,
    // consumerMagicMcpServerController,
    // consumerMagicMcpSessionController,
    // consumerMagicMcpTokenController
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

    secretController,

    serverController,
    serverVariantController,
    serverVersionController,
    serverListingController,
    serverListingCategoryController,
    serverListingCollectionController,

    serverImplementationController,
    serverDeploymentController,
    serverDeploymentTemplateController,

    sessionController,
    sessionEventController,
    sessionMessageController,

    serverRunController,
    serverRunErrorController,
    serverRunErrorGroupController,

    serverSessionController,
    sessionConnectionController,

    serverCapabilitiesController,

    providerOauthConnectionController,
    providerOauthConnectionAuthenticationController,
    providerOauthConnectionEventController,
    providerOauthConnectionProfileController,
    providerOauthTakeoutController,
    providerOauthTakeInController,

    serverOauthSessionController,

    profileController,

    dashboardOauthConnectionTemplateController,
    dashboardOauthDiscoveryController,

    customServerController,
    customServerVersionController,
    customServerEventController,
    customServerDeploymentController,
    remoteServerController,
    customServerCodeController,
    dashboardManagedServerTemplateController,

    magicMcpServerController,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,

    dashboardRepoController,

    callbackController,
    callbackEventController,
    callbackDestinationController,
    callbackNotificationController,

    serverConfigVaultController,
    teamRolePermissionsManagementController,
    teamRoleManagementController,
    teamManagementController,

    ssoTenantController,
    ssoUserController,
    ssoProfileController,

    portalController,
    portalConsumerGroupController,
    portalConsumerAccessController,
    portalConsumerProfileController,
    portalConsumerAuthFactorController,
    portalConsumerServerRequestController,
    portalFeaturedServersController
  }
);

export let fullDashboardController = Controller.create<any>(dashboardController.descriptor, {
  ...dashboardController.handlers,

  dashboardOrganizationController,
  dashboardOrganizationInviteController,
  dashboardBootController,
  dashboardUserController
});

// =============================================================================
// Magnetar Controllers (2026-02-01)
// =============================================================================

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
    subspaceSessionProviderController,
    subspaceSessionParticipantController,
    subspaceSessionErrorController,
    subspaceSessionErrorGroupController,
    subspaceProviderRunController,

    portalController,
    portalConsumerGroupController,
    portalConsumerAccessController,
    portalConsumerProfileController,
    portalConsumerAuthFactorController,
    consumerSessionController,

    teamManagementController,
    teamRoleManagementController,
    teamRolePermissionsManagementController,

    ssoTenantController,
    ssoUserController,
    ssoProfileController,

    fileController,
    fileLinkController
  }
);

// will be adjusted with new dashboard
export let magnetarDashboardController = Controller.create<any>(
  {
    name: 'Magnetar Dashboard API',
    description: 'Magnetar Dashboard API'
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

    secretController,

    serverController,
    serverVariantController,
    serverVersionController,
    serverListingController,
    serverListingCategoryController,
    serverListingCollectionController,

    serverImplementationController,
    serverDeploymentController,
    serverDeploymentTemplateController,

    sessionController,
    sessionEventController,
    sessionMessageController,

    serverRunController,
    serverRunErrorController,
    serverRunErrorGroupController,

    serverSessionController,
    sessionConnectionController,

    serverCapabilitiesController,

    serverOauthSessionController,

    profileController,

    dashboardRepoController,

    callbackController,
    callbackEventController,
    callbackDestinationController,
    callbackNotificationController,

    serverConfigVaultController,
    teamRolePermissionsManagementController,
    teamRoleManagementController,
    teamManagementController,

    ssoTenantController,
    ssoUserController,
    ssoProfileController,

    portalController,
    portalConsumerGroupController,
    portalConsumerAccessController,
    portalConsumerProfileController,
    portalConsumerAuthFactorController,
    portalConsumerServerRequestController,
    portalFeaturedServersController,

    // Provider API controllers (NEW in magnetar)
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
    providerSetupSessionController,
    providerAuthImportController,
    providerAuthExportController,
    sessionTemplateController,
    sessionTemplateProviderController,
    subspaceSessionProviderController,
    subspaceSessionParticipantController,
    subspaceSessionErrorController,
    subspaceSessionErrorGroupController,
    subspaceProviderRunController,

    // Deprecated controllers (shown in docs with deprecated badge)
    providerOauthConnectionController,
    providerOauthConnectionAuthenticationController,
    providerOauthConnectionEventController,
    providerOauthConnectionProfileController,
    providerOauthTakeoutController,
    providerOauthTakeInController,

    // Magic MCP - will be moved to provider system
    magicMcpServerController,
    magicMcpSessionController,
    magicMcpTokenController,
    magicMcpGroupController,

    // Custom Servers - will be replaced by provider system
    customServerController,
    customServerVersionController,
    customServerEventController,
    customServerDeploymentController,
    remoteServerController,
    customServerCodeController
  }
);
