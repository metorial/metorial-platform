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

    assignMember: (
      i: {
        actorId: string;
      },
      { input: { organizationId, teamId } }
    ) =>
      withAuth(sdk =>
        sdk.teams.members.create(organizationId, teamId, {
          actorId: i.actorId
        })
      ),

    removeMember: (
      i: {
        actorId: string;
      },
      { input: { organizationId, teamId } }
    ) => withAuth(sdk => sdk.teams.members.delete(organizationId, teamId, i.actorId)),

    assignPolicy: (
      i: {
        accessPolicyId: string;
      },
      { input: { organizationId, teamId } }
    ) =>
      withAuth(sdk =>
        sdk.teams.policies.create(organizationId, teamId, {
          accessPolicyId: i.accessPolicyId
        })
      ),

    removePolicy: (
      i: {
        accessPolicyId: string;
      },
      { input: { organizationId, teamId } }
    ) => withAuth(sdk => sdk.teams.policies.delete(organizationId, teamId, i.accessPolicyId))
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
    assignMemberMutator: member.useMutator('assignMember'),
    removeMemberMutator: member.useMutator('removeMember'),
    assignPolicyMutator: member.useMutator('assignPolicy'),
    removePolicyMutator: member.useMutator('removePolicy')
  };
};
