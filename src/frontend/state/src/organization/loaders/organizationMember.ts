import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let organizationMembersLoader = createLoader({
  name: 'organizationMembers',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.organizations.members.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    update: (
      i: {
        organizationMemberId: string;
        role: 'member' | 'admin';
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.organizations.members.update(organizationId, i.organizationMemberId, {
          role: i.role
        })
      ),

    delete: (i: { organizationMemberId: string }, { input: { organizationId } }) =>
      withAuth(sdk => sdk.organizations.members.delete(organizationId, i.organizationMemberId))
  }
});

export let useOrganizationMembers = (organizationId: string | null | undefined) => {
  let member = usePaginator(cursor =>
    organizationMembersLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...member,
    updateMutator: member.useMutator('update'),
    deleteMutator: member.useMutator('delete')
  };
};

export let organizationMemberLoader = createLoader({
  name: 'organizationMember',
  parents: [organizationMembersLoader],
  fetch: (i: { organizationId: string; organizationMemberId: string }) =>
    withAuth(sdk => sdk.organizations.members.get(i.organizationId, i.organizationMemberId)),
  mutators: {
    update: (
      i: { role: 'member' | 'admin' },
      { input: { organizationId, organizationMemberId } }
    ) =>
      withAuth(sdk =>
        sdk.organizations.members.update(organizationId, organizationMemberId, {
          role: i.role
        })
      ),

    delete: (i: { organizationMemberId: string }, { input: { organizationId } }) =>
      withAuth(sdk =>
        sdk.organizations.members.delete(organizationId, i.organizationMemberId)
      ),

    assignTeam: (i: { teamId: string }, { input: { organizationId }, output: { actorId } }) =>
      withAuth(sdk =>
        sdk.teams.members.create(organizationId, i.teamId, {
          actorId
        })
      ),

    removeTeam: (i: { teamId: string }, { input: { organizationId }, output: { actorId } }) =>
      withAuth(sdk => sdk.teams.members.delete(organizationId, i.teamId, actorId))
  }
});

export let useOrganizationMember = (
  organizationId: string | null | undefined,
  organizationMemberId: string | null | undefined
) => {
  let member = organizationMemberLoader.use(
    organizationId && organizationMemberId ? { organizationId, organizationMemberId } : null
  );

  return {
    ...member,
    updateMutator: member.useMutator('update'),
    deleteMutator: member.useMutator('delete'),
    assignTeamMutator: member.useMutator('assignTeam'),
    removeTeamMutator: member.useMutator('removeTeam')
  };
};
