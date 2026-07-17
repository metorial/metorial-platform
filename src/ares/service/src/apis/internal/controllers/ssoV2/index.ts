import { internalApp } from '../../_app';
import { accountsController } from './accounts';
import { ssoConnectionsController } from './connections';
import { ssoDelegationsController } from './delegations';
import { ssoDirectoriesController } from './directories';
import { ssoGroupsController } from './groups';
import { ssoRolesController } from './roles';
import { ssoScimLogsController } from './scimLogs';
import { ssoTenantsController } from './tenants';
import { ssoUsersController } from './users';

export let ssoV2Controller = internalApp.controller({
  accounts: accountsController,
  tenants: ssoTenantsController,
  connections: ssoConnectionsController,
  delegations: ssoDelegationsController,
  directories: ssoDirectoriesController,
  scimLogs: ssoScimLogsController,
  groups: ssoGroupsController,
  roles: ssoRolesController,
  users: ssoUsersController
});
