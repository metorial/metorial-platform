import { instanceScopes } from '@metorial/module-access';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { teamRolePermissionsPresenter } from '../../presenters';

export let teamRolePermissionsManagementController = Controller.create(
  {
    name: 'Organization Team',
    description: 'Read and write team information'
  },
  {
    get: organizationGroup
      .get(organizationManagementPath('team-role-permissions', 'teams.permissions'), {
        name: 'Get team',
        description: 'Get the information of a specific team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:read'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .output(teamRolePermissionsPresenter)
      .do(async ctx => {
        return teamRolePermissionsPresenter.present({ permissions: instanceScopes });
      })
  }
);
