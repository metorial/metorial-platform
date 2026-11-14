import { checkEdition } from '@metorial/editions';
import { internalApp } from '../../_app';
import { accountsController } from './accounts';
import { ssoConnectionsController } from './connections';
import { ssoDelegationsController } from './delegations';
import { ssoDirectoriesController } from './directories';
import type { ssoElevationController as CloudController } from './elevation';
import { ssoGroupsController } from './groups';
import { ssoRolesController } from './roles';
import { ssoScimLogsController } from './scimLogs';
import { ssoTenantsController } from './tenants';
import { ssoUsersController } from './users';

let ssoElevationController = (
  checkEdition('cloud')
    ? (await import('./elevation')).ssoElevationController
    : internalApp.controller({})
) as typeof CloudController;

export let ssoV2Controller = internalApp.controller({
  accounts: accountsController,
  tenants: ssoTenantsController,
  connections: ssoConnectionsController,
  delegations: ssoDelegationsController,
  directories: ssoDirectoriesController,
  elevation: ssoElevationController,
  scimLogs: ssoScimLogsController,
  groups: ssoGroupsController,
  roles: ssoRolesController,
  users: ssoUsersController
});
