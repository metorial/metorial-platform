import { beforeEach, describe, expect, it } from 'vitest';
import { expectServiceError } from '../../test/helpers';
import { createTestScope } from '../../test/scope';
import { cleanDatabase, testDb } from '../../test/setup';
import { instanceService } from '../instance';
import { organizationService } from '../organization';
import { projectService } from '../project';

describe('organization service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts by ref and merges settings', async () => {
    let created = await organizationService.upsertOrganization({
      input: {
        ref: 'org_a',
        name: 'Acme',
        settings: { allowedEmailDomains: ['acme.com'] }
      }
    });

    expect(created.id).toMatch(/^gor_/);
    expect(created.hashKeyVersion).toBe(1);

    let updated = await organizationService.upsertOrganization({
      input: { ref: 'org_a', settings: { sliceErasureMode: 'delete' } }
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Acme');
    expect(updated.settings).toEqual({
      allowedEmailDomains: ['acme.com'],
      sliceErasureMode: 'delete'
    });
    expect(await testDb.organization.count({ where: { ref: 'org_a' } })).toBe(1);
  });

  it('finds an organization by id or ref and hides archived ones', async () => {
    let organization = await organizationService.upsertOrganization({
      input: { ref: 'org_b' }
    });

    let byId = await organizationService.getOrganizationById({
      organizationId: organization.id
    });
    let byRef = await organizationService.getOrganizationById({ organizationId: 'org_b' });

    expect(byId.oid).toBe(organization.oid);
    expect(byRef.oid).toBe(organization.oid);

    let archived = await organizationService.archiveOrganization({ organization });

    expect(archived.archivedAt).toBeInstanceOf(Date);
    await expectServiceError(
      organizationService.getOrganizationById({ organizationId: 'org_b' }),
      'not_found'
    );

    let withArchived = await organizationService.getOrganizationById({
      organizationId: 'org_b',
      includeArchived: true
    });
    expect(withArchived.oid).toBe(organization.oid);

    let restored = await organizationService.upsertOrganization({ input: { ref: 'org_b' } });
    expect(restored.oid).toBe(organization.oid);
    expect(restored.archivedAt).toBeNull();
  });
});

describe('project service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('writes retention to existing and new instances', async () => {
    let { organization, project, instance } = await createTestScope();

    expect(instance.recordRetentionDays).toBe(90);

    let updated = await projectService.upsertProject({
      organization,
      input: {
        ref: project.ref,
        recordRetentionDays: 14,
        contentRetentionDays: 7,
        usageRetentionDays: 365
      }
    });

    expect(updated.id).toBe(project.id);

    let existing = await testDb.instance.findUniqueOrThrow({ where: { oid: instance.oid } });
    expect(existing).toMatchObject({
      recordRetentionDays: 14,
      contentRetentionDays: 7,
      usageRetentionDays: 365
    });

    let added = await instanceService.upsertInstance({
      organization,
      project: updated,
      input: { ref: `inst_${crypto.randomUUID()}` }
    });
    expect(added).toMatchObject({
      recordRetentionDays: 14,
      contentRetentionDays: 7,
      usageRetentionDays: 365
    });

    let untouched = await projectService.upsertProject({
      organization,
      input: { ref: project.ref, name: 'Renamed' }
    });
    expect(untouched.recordRetentionDays).toBe(14);
    expect(untouched.name).toBe('Renamed');
  });

  it('rejects a project ref that belongs to another organization', async () => {
    let first = await createTestScope();
    let second = await createTestScope();

    await expectServiceError(
      projectService.upsertProject({
        organization: second.organization,
        input: { ref: first.project.ref }
      }),
      'conflict'
    );
    await expectServiceError(
      projectService.getProjectById({
        organization: second.organization,
        projectId: first.project.id
      }),
      'not_found'
    );
  });

  it('archives a project', async () => {
    let { organization, project } = await createTestScope();

    let archived = await projectService.archiveProject({ project });

    expect(archived.archivedAt).toBeInstanceOf(Date);
    await expectServiceError(
      projectService.getProjectById({ organization, projectId: project.ref }),
      'not_found'
    );
    let restored = await projectService.upsertProject({
      organization,
      input: { ref: project.ref }
    });
    expect(restored.oid).toBe(project.oid);
    expect(restored.archivedAt).toBeNull();
  });
});

describe('instance service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts by ref, keeps untouched settings and clears nullable ones', async () => {
    let { organization, project, instance } = await createTestScope({
      instance: { skewBoundSeconds: 600, backfillMaxAgeDays: 30 }
    });

    expect(instance.skewBoundSeconds).toBe(600);

    let withSettings = await instanceService.upsertInstance({
      organization,
      project,
      input: { ref: instance.ref, settings: { ephemeralDeviceIdleDays: 3 } }
    });

    expect(withSettings.id).toBe(instance.id);
    expect(withSettings.skewBoundSeconds).toBe(600);
    expect(withSettings.backfillMaxAgeDays).toBe(30);

    let cleared = await instanceService.upsertInstance({
      organization,
      project,
      input: {
        ref: instance.ref,
        backfillMaxAgeDays: null,
        settings: { inferredSessionGapMinutes: 20 }
      }
    });

    expect(cleared.backfillMaxAgeDays).toBeNull();
    expect(cleared.settings).toEqual({
      ephemeralDeviceIdleDays: 3,
      inferredSessionGapMinutes: 20
    });
  });

  it('refuses to move an instance to another project', async () => {
    let { organization, instance } = await createTestScope();
    let other = await projectService.upsertProject({
      organization,
      input: { ref: `proj_${crypto.randomUUID()}` }
    });

    await expectServiceError(
      instanceService.upsertInstance({
        organization,
        project: other,
        input: { ref: instance.ref }
      }),
      'conflict'
    );
  });

  it('lists live instances of a project', async () => {
    let { organization, project, instance } = await createTestScope();
    let second = await instanceService.upsertInstance({
      organization,
      project,
      input: { ref: `inst_${crypto.randomUUID()}` }
    });

    await instanceService.archiveInstance({ instance: second });

    let paginator = await instanceService.listInstances({ project });
    let page = await paginator.run({ limit: 10 });

    expect(page.items.map(item => item.id)).toEqual([instance.id]);
    await expectServiceError(
      instanceService.getInstanceById({ organization, instanceId: second.id }),
      'not_found'
    );
  });
});
