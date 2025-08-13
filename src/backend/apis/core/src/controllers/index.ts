import { Controller } from '@metorial/rest';
import { dashboardApiKeyController } from './dashboard/apiKey';
import { dashboardBootController } from './dashboard/boot';
import { dashboardOauthConnectionTemplateController } from './dashboard/oauthConnectionTemplate';
import { dashboardOauthDiscoveryController } from './dashboard/oauthDiscovery';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { dashboardUsageController } from './dashboard/usage';
import { customServerController } from './instance/customServer';
import { customServerVersionController } from './instance/customServerVersion';
import { fileController } from './instance/file';
import { fileLinkController } from './instance/fileLink';
import { instanceController } from './instance/instance';
import { providerOauthConnectionController } from './instance/providerOauthConnection';
import { providerOauthConnectionAuthenticationController } from './instance/providerOauthConnectionAuthentication';
import { providerOauthConnectionEventController } from './instance/providerOauthConnectionEvent';
import { providerOauthConnectionProfileController } from './instance/providerOauthConnectionProfile';
import { remoteServerController } from './instance/remoteServer';
import { remoteServerNotificationController } from './instance/remoteServerNotifications';
import { secretController } from './instance/secret';
import { serverController } from './instance/server';
import { serverCapabilitiesController } from './instance/serverCapabilities';
import { serverDeploymentController } from './instance/serverDeployment';
import { serverImplementationController } from './instance/serverImplementation';
import { serverListingController } from './instance/serverListing';
import { serverListingCategoryController } from './instance/serverListingCategory';
import { serverListingCollectionController } from './instance/serverListingCollection';
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
import { userManagementController } from './management/user';

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
    providerOauthConnectionProfileController
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
    userManagementController,

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

    dashboardOauthConnectionTemplateController,
    dashboardOauthDiscoveryController,

    customServerController,
    customServerVersionController,
    remoteServerController,
    remoteServerNotificationController
  }
);
