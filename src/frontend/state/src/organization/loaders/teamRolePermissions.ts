import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let teamsRolePermissionsLoader = createLoader({
  name: 'teamsRolePermissions',
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk => sdk.teams.permissions(i.organizationId)),
  mutators: {}
});

export let useTeamRolePermissions = (organizationId: string | null | undefined) => {
  return teamsRolePermissionsLoader.use(organizationId ? { organizationId } : null);
};
