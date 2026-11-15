import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { instanceService, organizationService, projectService, teamService } from '../src';

describe('module-organization', () => {
  let org = useOrganization();

  it('resolves the bootstrapped organization, project and instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let membership = await organizationService.getOrganizationByIdForUser({
      organizationId: org.ids.organizationId,
      user: { id: org.ids.userId }
    });
    expect(membership.organization.id).toBe(org.ids.organizationId);
    expect(membership.actor.id).toBe(fixture.actor.id);

    let projects = await firstPage(
      await projectService.listProjects({
        organization: fixture.organization,
        actor: fixture.actor,
        member: fixture.member
      })
    );
    expect(projects.map(project => project.id)).toContain(org.ids.projectId);

    let instance = await instanceService.getInstanceById({
      organization: fixture.organization,
      instanceId: org.ids.instanceId,
      actor: fixture.actor,
      member: fixture.member
    });
    expect(instance.id).toBe(org.ids.instanceId);
  });

  it('creates and lists teams', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('team');

    let team = await teamService.createTeam({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name }
    });
    expect(team.name).toBe(name);

    let teams = await firstPage(
      await teamService.listTeams({ organization: fixture.organization })
    );
    expect(teams.map(item => item.id)).toContain(team.id);
  });
});
