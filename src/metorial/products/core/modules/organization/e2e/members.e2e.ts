import {
  bootstrapUser,
  expectServiceError,
  firstPage,
  testContext,
  uniqueEmail,
  uniqueId,
  useFixture,
  useOrganization
} from '@metorial/e2e';
import type { User } from '@metorial/db';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  organizationInviteJoinService,
  organizationInviteService,
  organizationMemberService,
  teamService
} from '../src';

describe('module-organization invites and members', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let soloOrg = useOrganization();
  let searchOrg = useOrganization();

  let signUp = async (input: Parameters<typeof bootstrapUser>[0] = {}) => {
    let user = await bootstrapUser(input);
    return db.user.findUniqueOrThrow({ where: { id: user.id } });
  };

  let createLinkInvite = async (
    role: 'admin' | 'member' = 'member',
    target: { ids: { organizationId: string } } = org
  ) => {
    let fixture = await loadOrganizationFixture(target.ids);
    let invite = await organizationInviteService.createOrganizationInvite({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { type: 'link', role }
    });
    return { fixture, invite };
  };

  let accept = (user: User, inviteKey: string) =>
    organizationInviteJoinService.acceptOrganizationInvite({
      user,
      inviteKey,
      context: testContext()
    });

  let joinSearchOrg = async (input: { name: string; email: string }) => {
    let { invite } = await createLinkInvite('member', searchOrg);
    let { member } = await accept(await signUp(input), invite.key);
    return member;
  };

  let searchMembers = useFixture(async () => {
    let tag = uniqueId('search');

    let alice = await joinSearchOrg({
      name: 'Alice Example',
      email: `alice-${tag}@e2e.metorial.test`
    });
    let bob = await joinSearchOrg({
      name: 'Bob Searchable',
      email: `bob-${tag}@e2e.metorial.test`
    });

    return { tag, alice, bob };
  });

  let searchIds = async (input: { search?: string; teamIds?: string[] }) => {
    let fixture = await loadOrganizationFixture(searchOrg.ids);
    let members = await firstPage(
      await organizationMemberService.listOrganizationMembers({
        organization: fixture.organization,
        ...input
      })
    );
    return members.map(member => member.id).sort();
  };

  it('joins a user through a link invite with the invite role', async () => {
    let { fixture, invite } = await createLinkInvite('admin');
    let user = await signUp();

    let joined = await accept(user, invite.key);
    expect(joined.organization.id).toBe(org.ids.organizationId);
    expect(joined.member).toMatchObject({ status: 'active', role: 'admin' });

    let storedInvite = await db.organizationInvite.findUniqueOrThrow({
      where: { id: invite.id },
      include: { joins: true }
    });
    expect(storedInvite).toMatchObject({ status: 'pending', useCount: 1 });
    expect(storedInvite.joins.map(join => join.memberOid)).toEqual([joined.member.oid]);

    let members = await firstPage(
      await organizationMemberService.listOrganizationMembers({
        organization: fixture.organization
      })
    );
    expect(members.map(member => member.id)).toContain(joined.member.id);
  });

  it('returns the existing membership when an active member accepts again', async () => {
    let { invite } = await createLinkInvite();
    let user = await signUp();

    let first = await accept(user, invite.key);
    let second = await accept(user, invite.key);

    expect(second.member.id).toBe(first.member.id);
    expect(
      (await db.organizationInvite.findUniqueOrThrow({ where: { id: invite.id } })).useCount
    ).toBe(1);
  });

  it('rejects unknown, deleted and expired invite keys', async () => {
    let user = await signUp();

    await expectServiceError(accept(user, `mt_${crypto.randomUUID()}`), 'not_found');

    let deleted = await createLinkInvite();
    await organizationInviteService.deleteOrganizationInvite({
      invite: deleted.invite,
      organization: deleted.fixture.organization,
      auditScope: deleted.fixture.auditScope
    });
    await expectServiceError(accept(user, deleted.invite.key), 'not_found');
    await expectServiceError(
      organizationInviteService.deleteOrganizationInvite({
        invite: { ...deleted.invite, status: 'deleted' },
        organization: deleted.fixture.organization,
        auditScope: deleted.fixture.auditScope
      }),
      'forbidden'
    );

    let expired = await createLinkInvite();
    await db.organizationInvite.update({
      where: { id: expired.invite.id },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });
    await expectServiceError(accept(user, expired.invite.key), 'not_found');

    expect(
      await db.organizationMember.count({
        where: { userOid: user.oid, organization: { id: org.ids.organizationId } }
      })
    ).toBe(0);
  });

  it('replaces a pending email invite and refuses to invite existing members', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let email = uniqueEmail('invitee');
    let invite = (input: { email: string }) =>
      organizationInviteService.createOrganizationInvite({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { type: 'email', role: 'member', email: input.email }
      });

    let first = await invite({ email });
    let second = await invite({ email });
    expect(second.id).not.toBe(first.id);
    expect(
      (await db.organizationInvite.findUniqueOrThrow({ where: { id: first.id } })).status
    ).toBe('deleted');

    let listed = await firstPage(
      await organizationInviteService.listOrganizationInvites({
        organization: fixture.organization
      })
    );
    expect(listed.filter(item => item.email === email).map(item => item.id)).toEqual([
      second.id
    ]);

    await expectServiceError(invite({ email: fixture.user.email }), 'forbidden');
  });

  it('marks an accepted email invite as used up', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let user = await signUp();
    let invite = await organizationInviteService.createOrganizationInvite({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { type: 'email', role: 'member', email: user.email }
    });

    await accept(user, invite.key);

    let stored = await db.organizationInvite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(stored.status).toBe('accepted');
    expect(stored.acceptedAt).toBeInstanceOf(Date);
    await expectServiceError(accept(await signUp(), invite.key), 'not_found');
  });

  it('protects the last admin', async () => {
    let fixture = await loadOrganizationFixture(soloOrg.ids);
    let owner = await organizationMemberService.getOrganizationMemberById({
      organization: fixture.organization,
      memberId: fixture.member.id
    });
    expect(owner.role).toBe('admin');

    let error = await expectServiceError(
      organizationMemberService.deleteOrganizationMember({
        organization: fixture.organization,
        member: owner,
        auditScope: fixture.auditScope
      }),
      'forbidden'
    );
    expect(error.reason).toBe('last_admin');

    await expectServiceError(
      organizationMemberService.updateOrganizationMember({
        organization: fixture.organization,
        member: owner,
        auditScope: fixture.auditScope,
        input: { role: 'member' }
      }),
      'forbidden'
    );
    expect(
      (await db.organizationMember.findUniqueOrThrow({ where: { oid: owner.oid } })).role
    ).toBe('admin');
  });

  it('removes a member and reactivates the same member and actor on rejoin', async () => {
    let { fixture, invite } = await createLinkInvite();
    let user = await signUp();
    let { member } = await accept(user, invite.key);

    let promoted = await organizationMemberService.updateOrganizationMember({
      organization: fixture.organization,
      member,
      auditScope: fixture.auditScope,
      input: { role: 'admin' }
    });
    expect(promoted.role).toBe('admin');

    let removed = await organizationMemberService.deleteOrganizationMember({
      organization: fixture.organization,
      member: promoted,
      auditScope: fixture.auditScope
    });
    expect(removed.status).toBe('deleted');

    let members = await firstPage(
      await organizationMemberService.listOrganizationMembers({
        organization: fixture.organization
      })
    );
    expect(members.map(item => item.id)).not.toContain(member.id);
    await expectServiceError(
      organizationMemberService.updateOrganizationMember({
        organization: fixture.organization,
        member: removed,
        auditScope: fixture.auditScope,
        input: { role: 'member' }
      }),
      'forbidden'
    );

    let rejoined = await accept(user, invite.key);
    expect(rejoined.member).toMatchObject({ id: member.id, status: 'active', role: 'member' });
    expect(rejoined.member.actorOid).toBe(member.actorOid);
  });

  it('does not resolve members of another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);

    await expectServiceError(
      organizationMemberService.getOrganizationMemberById({
        organization: other.organization,
        memberId: fixture.member.id
      }),
      'not_found'
    );
    await expectServiceError(
      organizationInviteService.getOrganizationInviteById({
        organization: other.organization,
        inviteId: (await createLinkInvite()).invite.id
      }),
      'not_found'
    );
  });

  it('searches members by partial name or email regardless of case', async () => {
    let { tag, alice, bob } = searchMembers;

    expect(await searchIds({ search: `ALICE-${tag.toUpperCase()}` })).toEqual([alice.id]);
    expect(await searchIds({ search: 'ob sEARCH' })).toEqual([bob.id]);
    expect(await searchIds({ search: '@E2E.METORIAL.TEST' })).toEqual(
      expect.arrayContaining([alice.id, bob.id])
    );
  });

  it('matches LIKE wildcards in a search literally', async () => {
    let { tag } = searchMembers;

    let quinn = await joinSearchOrg({
      name: 'Quinn Underscore',
      email: `quinn_${tag}@e2e.metorial.test`
    });
    await joinSearchOrg({
      name: 'Quinn Lookalike',
      email: `quinnx${tag}@e2e.metorial.test`
    });

    expect(await searchIds({ search: `quinn_${tag}` })).toEqual([quinn.id]);
    expect(await searchIds({ search: `quinn%${tag}` })).toEqual([]);
  });

  it('returns every member for a blank or whitespace search', async () => {
    let { alice, bob } = searchMembers;
    let all = await searchIds({});

    expect(all).toEqual(expect.arrayContaining([alice.id, bob.id]));
    expect(await searchIds({ search: '' })).toEqual(all);
    expect(await searchIds({ search: '   ' })).toEqual(all);
  });

  it('applies search and team filters together', async () => {
    let { tag, alice, bob } = searchMembers;
    let fixture = await loadOrganizationFixture(searchOrg.ids);
    let team = await teamService.createTeam({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Search Team') }
    });
    let { actor } = await db.organizationMember.findUniqueOrThrow({
      where: { id: bob.id },
      include: { actor: true }
    });
    await teamService.assignActorToTeam({
      team,
      actor,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    });

    expect(await searchIds({ search: tag, teamIds: [team.id] })).toEqual([bob.id]);
    expect(await searchIds({ search: `alice-${tag}`, teamIds: [team.id] })).toEqual([]);
    expect(await searchIds({ search: `alice-${tag}` })).toEqual([alice.id]);
  });

  it('excludes deleted members from search results', async () => {
    let { tag } = searchMembers;
    let fixture = await loadOrganizationFixture(searchOrg.ids);
    let dana = await joinSearchOrg({
      name: 'Dana Removed',
      email: `dana-${tag}@e2e.metorial.test`
    });

    expect(await searchIds({ search: 'DANA REMOVED' })).toEqual([dana.id]);

    await organizationMemberService.deleteOrganizationMember({
      organization: fixture.organization,
      member: dana,
      auditScope: fixture.auditScope
    });

    expect(await searchIds({ search: 'DANA REMOVED' })).toEqual([]);
    expect(await searchIds({ search: `dana-${tag}` })).toEqual([]);
  });
});
