import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let teamsLoader = createLoader({
  name: 'teams',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.teams.list(i.organizationId, {
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
        sdk.teams.create(organizationId, {
          name: i.name,
          description: i.description
        })
      )
  }
});

export let useTeams = (organizationId: string | null | undefined) => {
  let member = usePaginator(cursor =>
    teamsLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...member,
    createMutator: member.useMutator('create')
  };
};

export let teamLoader = createLoader({
  name: 'team',
  parents: [teamsLoader],
  fetch: (i: { organizationId: string; teamId: string }) =>
    withAuth(sdk => sdk.teams.get(i.organizationId, i.teamId)),
  mutators: {
    update: (
      i: {
        name?: string;
        description?: string;
      },
      { input: { organizationId, teamId } }
    ) =>
      withAuth(sdk =>
        sdk.teams.update(organizationId, teamId, {
          name: i.name,
          description: i.description
        })
      ),

    setProject: (
      i: {
        projectId: string;
        teamRoleIds: string[];
      },
      { input: { organizationId, teamId } }
    ) =>
      withAuth(sdk =>
        sdk.teams.projects.set(organizationId, teamId, {
          projectId: i.projectId,
          teamRoleIds: i.teamRoleIds
        })
      ),

    removeProject: (
      i: {
        projectId: string;
      },
      { input: { organizationId, teamId } }
    ) => withAuth(sdk => sdk.teams.projects.remove(organizationId, teamId, i.projectId))
  }
});

export let useTeam = (
  organizationId: string | null | undefined,
  teamId: string | null | undefined
) => {
  let member = teamLoader.use(organizationId && teamId ? { organizationId, teamId } : null);

  return {
    ...member,
    updateMutator: member.useMutator('update'),
    setProjectMutator: member.useMutator('setProject'),
    removeProjectMutator: member.useMutator('removeProject')
  };
};
