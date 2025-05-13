import { Controller } from '@metorial/rest';
import { dashboardApiKeyController } from './dashboard/apiKey';
import { dashboardBootController } from './dashboard/boot';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { fileController } from './instance/file';
import { fileLinkController } from './instance/fileLink';
import { instanceController } from './instance/instance';
import { secretController } from './instance/secret';
import { serverController } from './instance/server';
import { serverListingController } from './instance/serverListing';
import { serverListingCategoryController } from './instance/serverListingCategory';
import { serverListingCollectionController } from './instance/serverListingCollection';
import { serverVariantController } from './instance/serverVariant';
import { serverVersionController } from './instance/serverVersion';
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
    serverVersionController
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
    serverListingCollectionController
  }
);
