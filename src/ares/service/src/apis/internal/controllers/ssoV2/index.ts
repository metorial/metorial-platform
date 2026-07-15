import { internalApp } from '../../_app';
import { accountsController } from './accounts';
import { ssoConnectionsController } from './connections';
import { ssoDirectoriesController } from './directories';
import { ssoGroupsController } from './groups';
import { ssoRolesController } from './roles';
import { ssoTenantsController } from './tenants';
import { ssoUsersController } from './users';

export let ssoV2Controller = internalApp.controller({
  accounts: accountsController,
  tenants: ssoTenantsController,
  connections: ssoConnectionsController,
  directories: ssoDirectoriesController,
  groups: ssoGroupsController,
  roles: ssoRolesController,
  users: ssoUsersController
});
