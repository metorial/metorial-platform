import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let teamsRolesLoader = createLoader({
  name: 'teamsRoles',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.teams.roles.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    create: (
      i: {
        name: string;
        description?: string;
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.teams.roles.create(organizationId, {
          name: i.name,
          description: i.description
        })
      )
  }
});

export let useTeamRoles = (organizationId: string | null | undefined) => {
  let member = usePaginator(cursor =>
    teamsRolesLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...member,
    createMutator: member.useMutator('create')
  };
};

export let teamRoleLoader = createLoader({
  name: 'teamRole',
  parents: [teamsRolesLoader],
  fetch: (i: { organizationId: string; teamId: string }) =>
    withAuth(sdk => sdk.teams.roles.get(i.organizationId, i.teamId)),
  mutators: {
    update: (
      i: {
        name?: string;
        description?: string;
        permissions?: string[];
      },
      { input: { organizationId, teamId } }
    ) =>
      withAuth(sdk =>
        sdk.teams.roles.update(organizationId, teamId, {
          name: i.name,
          description: i.description,
          permissions: i.permissions
        })
      )
  }
});

export let useTeamRole = (
  organizationId: string | null | undefined,
  teamId: string | null | undefined
) => {
  let member = teamRoleLoader.use(
    organizationId && teamId ? { organizationId, teamId } : null
  );

  return {
    ...member,
    updateMutator: member.useMutator('update')
  };
};
