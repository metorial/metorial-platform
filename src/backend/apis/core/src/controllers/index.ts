import { Controller } from '@metorial/rest';
import { dashboardApiKeyController } from './dashboard/apiKey';
import { dashboardBootController } from './dashboard/boot';
import { dashboardManagedServerTemplateController } from './dashboard/managedServerTemplate';
import { dashboardOauthConnectionTemplateController } from './dashboard/oauthConnectionTemplate';
import { dashboardOauthDiscoveryController } from './dashboard/oauthDiscovery';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { profileController } from './dashboard/profile';
import { dashboardUsageController } from './dashboard/usage';
import { dashboardUserController } from './dashboard/user';
import { customServerController } from './instance/customServer';
import { customServerCodeController } from './instance/customServerCode';
import { customServerDeploymentController } from './instance/customServerDeployment';
import { customServerEventController } from './instance/customServerEvent';
import { customServerVersionController } from './instance/customServerVersion';
import { fileController } from './instance/file';
import { fileLinkController } from './instance/fileLink';
import { instanceController } from './instance/instance';
import { magicMcpServerController } from './instance/magicMcpServer';
import { magicMcpSessionController } from './instance/magicMcpSession';
import { magicMcpTokenController } from './instance/magicMcpToken';
import { providerOauthConnectionController } from './instance/providerOauthConnection';
import { providerOauthConnectionAuthenticationController } from './instance/providerOauthConnectionAuthentication';
import { providerOauthConnectionEventController } from './instance/providerOauthConnectionEvent';
import { providerOauthConnectionProfileController } from './instance/providerOauthConnectionProfile';
import { remoteServerController } from './instance/remoteServer';
import { secretController } from './instance/secret';
import { serverController } from './instance/server';
import { serverCapabilitiesController } from './instance/serverCapabilities';
import { serverDeploymentController } from './instance/serverDeployment';
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
import { instanceManagementController } from './management/instance';
import { organizationManagementController } from './management/organization';
import { organizationInviteManagementController } from './management/organizationInvite';
import { organizationMemberManagementController } from './management/organizationMember';
import { projectManagementController } from './management/project';

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

    serverImplementationController,
    serverDeploymentController,

    sessionController,
    sessionMessageController,

    serverRunController,
    serverRunErrorController,

    sessionConnectionController,

    serverCapabilitiesController,

    providerOauthConnectionController,
    providerOauthConnectionAuthenticationController,
    providerOauthConnectionProfileController,

    serverOauthSessionController,

    magicMcpServerController,
    magicMcpSessionController,
    magicMcpTokenController
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
    magicMcpTokenController
  }
);

export let fullDashboardController = Controller.create<any>(dashboardController.descriptor, {
  ...dashboardController.handlers,

  dashboardOrganizationController,
  dashboardOrganizationInviteController,
  dashboardBootController,
  dashboardUserController
});
