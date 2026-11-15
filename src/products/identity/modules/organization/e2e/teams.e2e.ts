import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { organizationMemberService, teamService } from '../src';

describe('module-organization teams', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let createTeam = async (name = uniqueId('team')) => {
    let fixture = await loadOrganizationFixture(org.ids);
    let team = await teamService.createTeam({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name, description: 'Initial' }
    });
    return { fixture, team };
  };

  it('creates, resolves and updates a team', async () => {
    let name = uniqueId('Team');
    let { fixture, team } = await createTeam(name);

    let row = await db.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(row).toMatchObject({
      name,
      description: 'Initial',
      organizationOid: fixture.organization.oid
    });
    expect(row.slug).toBeTruthy();

    let bySlug = await teamService.getTeamById({
      organization: fixture.organization,
      teamId: team.slug
    });
    expect(bySlug.id).toBe(team.id);

    let updated = await teamService.updateTeam({
      team,
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: `${name} renamed` }
    });
    expect(updated).toMatchObject({ name: `${name} renamed`, description: 'Initial' });
    expect(updated.slug).toBe(team.slug);

    let teams = await firstPage(
      await teamService.listTeams({ organization: fixture.organization })
    );
    expect(teams.map(item => item.id)).toContain(team.id);
  });

  it('gives teams with the same name distinct slugs', async () => {
    let name = uniqueId('Team');
    let first = await createTeam(name);
    let second = await createTeam(name);

    expect(second.team.slug).not.toBe(first.team.slug);
  });

  it('does not resolve or list teams of another organization', async () => {
    let { team } = await createTeam();
    let other = await loadOrganizationFixture(otherOrg.ids);

    await expectServiceError(
      teamService.getTeamById({ organization: other.organization, teamId: team.id }),
      'not_found'
    );
    await expectServiceError(
      teamService.getTeamById({ organization: other.organization, teamId: team.slug }),
      'not_found'
    );

    let teams = await firstPage(
      await teamService.listTeams({ organization: other.organization })
    );
    expect(teams.map(item => item.id)).not.toContain(team.id);
  });

  it('adds members idempotently, filters members by team and removes them', async () => {
    let { fixture, team } = await createTeam();
    let { actor } = await db.organizationMember.findUniqueOrThrow({
      where: { id: member.member.id },
      include: { actor: true }
    });
    let input = {
      team,
      actor,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    };

    let added = await teamService.assignActorToTeam(input);
    let addedAgain = await teamService.assignActorToTeam(input);
    expect(addedAgain.id).toBe(added.id);
    expect(await db.teamMember.count({ where: { teamOid: team.oid } })).toBe(1);

    let members = await firstPage(
      await organizationMemberService.listOrganizationMembers({
        organization: fixture.organization,
        teamIds: [team.slug]
      })
    );
    expect(members.map(item => item.id)).toEqual([member.member.id]);

    await teamService.removeActorFromTeam(input);
    expect(await db.teamMember.count({ where: { teamOid: team.oid } })).toBe(0);

    await expectServiceError(teamService.removeActorFromTeam(input), 'bad_request');
  });
});
