import { Controller } from '@metorial/rest';
import { fileController } from './core/file';
import { fileLinkController } from './core/fileLink';
import { secretController } from './core/secret';
import { dashboardApiKeyController } from './dashboard/apiKey';
import { dashboardBootController } from './dashboard/boot';
import { dashboardOrganizationController } from './dashboard/organization';
import { dashboardOrganizationInviteController } from './dashboard/organizationInvite';
import { instanceController } from './management/instance';
import { organizationController } from './management/organization';
import { organizationInviteController } from './management/organizationInvite';
import { organizationMemberController } from './management/organizationMember';
import { projectController } from './management/project';
import { userController } from './management/user';

export let pulsarController = Controller.create<any>(
  {
    name: 'Pulsar API',
    description: 'Pulsar API'
  },
  {
    dashboardOrganizationController,
    dashboardOrganizationInviteController,
    dashboardBootController,
    dashboardApiKeyController,

    instanceController,
    organizationController,
    organizationInviteController,
    organizationMemberController,
    projectController,
    userController,

    fileController,
    fileLinkController,

    secretController
  }
);
