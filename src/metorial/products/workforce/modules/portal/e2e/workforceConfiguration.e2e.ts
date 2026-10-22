import { eventually, expectServiceError, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { projectWorkforceConfigurationService } from '../src';
import { createPortal } from './_fixtures';

describe('module-portal project workforce configuration', () => {
  let org = useOrganization();

  it('refuses inactive projects', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let deleted = { ...fixture.project, status: 'deleted' as const };

    await expectServiceError(
      projectWorkforceConfigurationService.getProjectWorkforceConfiguration({
        project: deleted
      }),
      'forbidden'
    );
    await expectServiceError(
      projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
        project: deleted,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          autoAddOrganizationMembersToPortals: !deleted.autoAddOrganizationMembersToPortals
        }
      }),
      'forbidden'
    );

    let row = await db.project.findUniqueOrThrow({ where: { oid: fixture.project.oid } });
    expect(row.autoAddOrganizationMembersToPortals).toBe(
      fixture.project.autoAddOrganizationMembersToPortals
    );
  });

  it('adds organization members to existing portals once auto-add is enabled', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let project =
      await projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
        project: fixture.project,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { autoAddOrganizationMembersToPortals: false }
      });
    expect(project.autoAddOrganizationMembersToPortals).toBe(false);

    let portal = await createPortal(fixture);
    let profileWhere = { surfaceOid: portal.surfaceOid, email: fixture.user.email };
    expect(await db.consumerProfile.count({ where: profileWhere })).toBe(0);

    let enabled =
      await projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
        project,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { autoAddOrganizationMembersToPortals: true }
      });
    expect(enabled.autoAddOrganizationMembersToPortals).toBe(true);
    let row = await db.project.findUniqueOrThrow({ where: { oid: fixture.project.oid } });
    expect(row.autoAddOrganizationMembersToPortals).toBe(true);

    let profile = await eventually(async () => {
      let profile = await db.consumerProfile.findFirst({ where: profileWhere });
      expect(profile).toBeTruthy();
      return profile!;
    });
    expect(profile).toMatchObject({
      status: 'active',
      name: fixture.user.name,
      instanceOid: fixture.instance.oid
    });

    let current = await projectWorkforceConfigurationService.getProjectWorkforceConfiguration({
      project: row
    });
    expect(current.autoAddOrganizationMembersToPortals).toBe(true);
  });
});
