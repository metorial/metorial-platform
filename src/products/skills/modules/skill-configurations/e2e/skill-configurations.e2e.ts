import {
  eventually,
  expectOk,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { skillConfigurationService } from '../src';

let propagationTimeout = { timeoutMs: 90_000, intervalMs: 1_000 };

let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

let createConfiguration = async (
  fixture: OrganizationFixture,
  input: Parameters<typeof skillConfigurationService.createSkillConfiguration>[0]['input'] = {}
) => await skillConfigurationService.createSkillConfiguration({ ...scopeOf(fixture), input });

let listIds = async (fixture: OrganizationFixture, ids: string[]) =>
  (
    await firstPage(
      await skillConfigurationService.listSkillConfigurations({ ...scopeOf(fixture), ids })
    )
  )
    .map(item => item.id)
    .sort();

let createInstanceFixture = async (org: BootstrappedOrganization) => {
  let base = `/dashboard/organizations/${org.ids.organizationId}`;
  let project = expectOk(
    await org.clients.rest.post(`${base}/projects`, { name: uniqueId('E2E Project') })
  );
  let instances = expectOk(
    await org.clients.rest.get(`${base}/instances`, { query: { project_id: project.id } })
  );

  return await loadOrganizationFixture({
    organizationId: org.ids.organizationId,
    instanceId: instances.items[0].id
  });
};

let createPluginDestination = async (
  fixture: OrganizationFixture,
  skillConfigurationOid: bigint | null
) => {
  let destination = await db.skillDestination.create({
    data: {
      id: await ID.generateId('skillDestination'),
      codeBucketId: uniqueId('e2e-code-bucket')
    }
  });

  await db.skillPlugin.create({
    data: {
      id: await ID.generateId('skillPlugin'),
      name: uniqueId('e2e-plugin'),
      organizationOid: fixture.organization.oid,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      destinationOid: destination.oid,
      skillConfigurationOid
    }
  });

  return destination;
};

let getDestination = async (id: string) =>
  await db.skillDestination.findUniqueOrThrow({ where: { id } });

let expectDestinationTouched = async (id: string) =>
  await eventually(async () => {
    let destination = await getDestination(id);
    expect(destination.lastTransientChangeAt).toBeInstanceOf(Date);
    return destination;
  }, propagationTimeout);

describe('module-skill-configurations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates configurations with defaults and normalized file extensions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let defaults = await createConfiguration(fixture);
    expect(defaults).toMatchObject({
      allowScripts: true,
      allowedFileExtensions: [],
      allowNonStandardDirectories: true,
      isInternal: false,
      deletedAt: null
    });
    expect(defaults.isDefault).toBeFalsy();

    let normalized = await createConfiguration(fixture, {
      allowScripts: false,
      allowedFileExtensions: ['MD', ' .Txt ', '', '.md', 'json', '.TXT'],
      allowNonStandardDirectories: false
    });
    expect(normalized.allowedFileExtensions).toEqual(['.md', '.txt', '.json']);

    let blankOnly = await createConfiguration(fixture, { allowedFileExtensions: ['', '  '] });
    expect(blankOnly.allowedFileExtensions).toEqual([]);

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: normalized.id } });
    expect(row).toMatchObject({
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid,
      allowScripts: false,
      allowNonStandardDirectories: false,
      allowedFileExtensions: ['.md', '.txt', '.json']
    });

    let fetched = await skillConfigurationService.getSkillConfigurationById({
      ...scopeOf(fixture),
      skillConfigurationId: normalized.id
    });
    expect(fetched.id).toBe(normalized.id);
  });

  it('updates only the given fields and clears extensions with null', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createConfiguration(fixture, {
      allowScripts: false,
      allowedFileExtensions: ['.md', '.txt']
    });

    let directories = await skillConfigurationService.updateSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: created.id,
      input: { allowNonStandardDirectories: false }
    });
    expect(directories).toMatchObject({
      allowScripts: false,
      allowedFileExtensions: ['.md', '.txt'],
      allowNonStandardDirectories: false
    });

    let extensions = await skillConfigurationService.updateSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: created.id,
      input: { allowedFileExtensions: ['YAML', 'md'] }
    });
    expect(extensions.allowedFileExtensions).toEqual(['.yaml', '.md']);

    let cleared = await skillConfigurationService.updateSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: created.id,
      input: { allowedFileExtensions: null }
    });
    expect(cleared.allowedFileExtensions).toEqual([]);

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({
      allowScripts: false,
      allowedFileExtensions: [],
      allowNonStandardDirectories: false
    });
  });

  it('rejects extension lists without .md and empty updates without changing the row', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let invalidCreate = await expectServiceError(
      createConfiguration(fixture, { allowedFileExtensions: ['.txt', 'json'] }),
      'bad_request'
    );
    expect(invalidCreate.message).toMatch(/must include \.md/);

    let created = await createConfiguration(fixture, { allowedFileExtensions: ['.md'] });

    await expectServiceError(
      skillConfigurationService.updateSkillConfiguration({
        ...scopeOf(fixture),
        skillConfigurationId: created.id,
        input: { allowScripts: false, allowedFileExtensions: ['.txt'] }
      }),
      'bad_request'
    );

    let emptyUpdate = await expectServiceError(
      skillConfigurationService.updateSkillConfiguration({
        ...scopeOf(fixture),
        skillConfigurationId: created.id,
        input: {}
      }),
      'bad_request'
    );
    expect(emptyUpdate.message).toMatch(/At least one/);

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.allowScripts).toBe(true);
    expect(row.allowedFileExtensions).toEqual(['.md']);
  });

  it('lists configurations by id and date, without internal or deleted ones', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = new Date(Date.now() - 1_000);

    let first = await createConfiguration(fixture);
    let second = await createConfiguration(fixture);
    let internal = await createConfiguration(fixture, { isInternal: true });
    let deleted = await createConfiguration(fixture);
    await skillConfigurationService.deleteSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: deleted.id
    });

    expect(await listIds(fixture, [first.id, second.id, internal.id, deleted.id])).toEqual(
      [first.id, second.id].sort()
    );

    let createdSince = await firstPage(
      await skillConfigurationService.listSkillConfigurations({
        ...scopeOf(fixture),
        ids: [first.id, second.id],
        createdAt: { gt: before }
      })
    );
    expect(createdSince).toHaveLength(2);

    let createdBefore = await firstPage(
      await skillConfigurationService.listSkillConfigurations({
        ...scopeOf(fixture),
        ids: [first.id, second.id],
        createdAt: { lt: before }
      })
    );
    expect(createdBefore).toEqual([]);

    let internalFetched = await skillConfigurationService.getSkillConfigurationById({
      ...scopeOf(fixture),
      skillConfigurationId: internal.id
    });
    expect(internalFetched.isInternal).toBe(true);
  });

  it('creates exactly one default per instance, also under concurrent first reads', async () => {
    let fixture = await createInstanceFixture(org);
    expect(
      await db.skillConfiguration.count({
        where: { instanceOid: fixture.instance.oid, isDefault: true }
      })
    ).toBe(0);

    let defaults = await Promise.all(
      Array.from({ length: 5 }, () =>
        skillConfigurationService.getSkillConfigurationById({
          ...scopeOf(fixture),
          skillConfigurationId: 'default'
        })
      )
    );
    expect(new Set(defaults.map(item => item.id)).size).toBe(1);
    expect(defaults[0]).toMatchObject({
      isDefault: true,
      allowScripts: true,
      allowedFileExtensions: [],
      allowNonStandardDirectories: true
    });

    let upserted = await skillConfigurationService.upsertDefaultSkillConfiguration(
      scopeOf(fixture)
    );
    expect(upserted.id).toBe(defaults[0]!.id);
    expect(
      await db.skillConfiguration.count({
        where: { instanceOid: fixture.instance.oid, isDefault: true }
      })
    ).toBe(1);

    expect(await listIds(fixture, [upserted.id])).toEqual([upserted.id]);
  });

  it('updates the default through its alias and never deletes it', async () => {
    let fixture = await createInstanceFixture(org);

    let updated = await skillConfigurationService.updateSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: 'default',
      input: { allowScripts: false, allowedFileExtensions: ['md'] }
    });
    expect(updated).toMatchObject({
      isDefault: true,
      allowScripts: false,
      allowedFileExtensions: ['.md']
    });

    let byAlias = await skillConfigurationService.getSkillConfigurationById({
      ...scopeOf(fixture),
      skillConfigurationId: 'default'
    });
    expect(byAlias.id).toBe(updated.id);
    expect(byAlias.allowScripts).toBe(false);

    for (let skillConfigurationId of ['default', updated.id]) {
      let error = await expectServiceError(
        skillConfigurationService.deleteSkillConfiguration({
          ...scopeOf(fixture),
          skillConfigurationId
        }),
        'forbidden'
      );
      expect(error.message).toMatch(/Default skill configuration/);
    }

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: updated.id } });
    expect(row.deletedAt).toBeNull();
  });

  it('refuses to delete internal configurations', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let internal = await createConfiguration(fixture, { isInternal: true });

    let error = await expectServiceError(
      skillConfigurationService.deleteSkillConfiguration({
        ...scopeOf(fixture),
        skillConfigurationId: internal.id
      }),
      'forbidden'
    );
    expect(error.message).toMatch(/Internal skill configurations/);

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: internal.id } });
    expect(row.deletedAt).toBeNull();
  });

  it('soft-deletes a configuration and then treats it as gone', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createConfiguration(fixture);

    let deleted = await skillConfigurationService.deleteSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: created.id
    });
    expect(deleted.deletedAt).toBeInstanceOf(Date);

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.deletedAt).toEqual(deleted.deletedAt);

    await expectServiceError(
      skillConfigurationService.getSkillConfigurationById({
        ...scopeOf(fixture),
        skillConfigurationId: created.id
      }),
      'not_found'
    );
    await expectServiceError(
      skillConfigurationService.updateSkillConfiguration({
        ...scopeOf(fixture),
        skillConfigurationId: created.id,
        input: { allowScripts: false }
      }),
      'not_found'
    );
    await expectServiceError(
      skillConfigurationService.deleteSkillConfiguration({
        ...scopeOf(fixture),
        skillConfigurationId: created.id
      }),
      'not_found'
    );
    expect(await listIds(fixture, [created.id])).toEqual([]);

    let unchanged = await db.skillConfiguration.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(unchanged.allowScripts).toBe(true);
    expect(unchanged.deletedAt).toEqual(deleted.deletedAt);

    await expectServiceError(
      skillConfigurationService.getSkillConfigurationById({
        ...scopeOf(fixture),
        skillConfigurationId: 'skc_does_not_exist'
      }),
      'not_found'
    );
  });

  it('scopes configurations and defaults to their project and instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let secondInstance = await createInstanceFixture(org);
    let created = await createConfiguration(fixture);

    await expectServiceError(
      skillConfigurationService.getSkillConfigurationById({
        ...scopeOf(secondInstance),
        skillConfigurationId: created.id
      }),
      'not_found'
    );
    await expectServiceError(
      skillConfigurationService.updateSkillConfiguration({
        ...scopeOf(secondInstance),
        skillConfigurationId: created.id,
        input: { allowScripts: false }
      }),
      'not_found'
    );
    await expectServiceError(
      skillConfigurationService.deleteSkillConfiguration({
        ...scopeOf(secondInstance),
        skillConfigurationId: created.id
      }),
      'not_found'
    );
    expect(await listIds(secondInstance, [created.id])).toEqual([]);
    expect(
      await skillConfigurationService.getManySkillConfigurations({
        ...scopeOf(secondInstance),
        skillConfigurationIds: [created.id]
      })
    ).toEqual([]);

    await expectServiceError(
      skillConfigurationService.getSkillConfigurationById({
        project: secondInstance.project,
        instance: fixture.instance,
        skillConfigurationId: created.id
      }),
      'not_found'
    );

    let firstDefault = await skillConfigurationService.getSkillConfigurationById({
      ...scopeOf(fixture),
      skillConfigurationId: 'default'
    });
    let secondDefault = await skillConfigurationService.getSkillConfigurationById({
      ...scopeOf(secondInstance),
      skillConfigurationId: 'default'
    });
    expect(secondDefault.id).not.toBe(firstDefault.id);
    expect(secondDefault.instanceOid).toBe(secondInstance.instance.oid);

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.allowScripts).toBe(true);
    expect(row.deletedAt).toBeNull();
  });

  it('does not expose configurations to another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let created = await createConfiguration(fixture);

    await expectServiceError(
      skillConfigurationService.getSkillConfigurationById({
        ...scopeOf(other),
        skillConfigurationId: created.id
      }),
      'not_found'
    );
    await expectServiceError(
      skillConfigurationService.updateSkillConfiguration({
        ...scopeOf(other),
        skillConfigurationId: created.id,
        input: { allowScripts: false }
      }),
      'not_found'
    );
    await expectServiceError(
      skillConfigurationService.deleteSkillConfiguration({
        ...scopeOf(other),
        skillConfigurationId: created.id
      }),
      'not_found'
    );
    expect(await listIds(other, [created.id])).toEqual([]);
    expect(
      await skillConfigurationService.getManySkillConfigurations({
        ...scopeOf(other),
        skillConfigurationIds: [created.id, 'default']
      })
    ).toEqual([]);

    let row = await db.skillConfiguration.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.allowScripts).toBe(true);
    expect(row.deletedAt).toBeNull();
  });

  it('marks destinations of plugins using an updated or deleted configuration dirty', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let updatedConfiguration = await createConfiguration(fixture);
    let deletedConfiguration = await createConfiguration(fixture);
    let updatedDestination = await createPluginDestination(fixture, updatedConfiguration.oid);
    let deletedDestination = await createPluginDestination(fixture, deletedConfiguration.oid);

    await skillConfigurationService.updateSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: updatedConfiguration.id,
      input: { allowScripts: false }
    });
    await expectDestinationTouched(updatedDestination.id);
    expect((await getDestination(deletedDestination.id)).lastTransientChangeAt).toBeNull();

    await skillConfigurationService.deleteSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: deletedConfiguration.id
    });
    await expectDestinationTouched(deletedDestination.id);
  }, 240_000);

  it('propagates default configuration changes only to plugins without their own', async () => {
    let fixture = await createInstanceFixture(org);
    let ownConfiguration = await createConfiguration(fixture);
    let inheritingDestination = await createPluginDestination(fixture, null);
    let ownDestination = await createPluginDestination(fixture, ownConfiguration.oid);

    await skillConfigurationService.updateSkillConfiguration({
      ...scopeOf(fixture),
      skillConfigurationId: 'default',
      input: { allowNonStandardDirectories: false }
    });
    await expectDestinationTouched(inheritingDestination.id);
    expect((await getDestination(ownDestination.id)).lastTransientChangeAt).toBeNull();
  }, 180_000);
});
