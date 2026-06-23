import { beforeEach, describe, expect, it } from 'vitest';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let createScope = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-skill-configurations',
    name: 'Tenant Skill Configurations'
  });

  let environment = await cargoClient.environment.upsert({
    tenantId: tenant.id,
    identifier: 'prod',
    name: 'Production',
    type: 'production'
  });

  return {
    tenant,
    environment
  };
};

describe('cargo skillConfiguration.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates, lists, gets, updates, and soft deletes skill configurations', async () => {
    let { tenant, environment } = await createScope();

    let created = await cargoClient.skillConfiguration.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      allowScripts: false,
      allowedFileExtensions: ['md', '.ts'],
      allowNonStandardDirectories: false
    });

    expect(created).toMatchObject({
      object: 'cargo#skillConfiguration',
      isDefault: false,
      isInternal: false,
      allowScripts: false,
      allowedFileExtensions: ['.md', '.ts'],
      allowNonStandardDirectories: false,
      deletedAt: null
    });

    let listed = await cargoClient.skillConfiguration.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]!.id).toBe(created.id);

    let fetched = await cargoClient.skillConfiguration.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: created.id
    });
    expect(fetched.id).toBe(created.id);

    let updated = await cargoClient.skillConfiguration.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: created.id,
      allowScripts: true,
      allowedFileExtensions: null
    });
    expect(updated).toMatchObject({
      id: created.id,
      allowScripts: true,
      allowedFileExtensions: []
    });

    let deleted = await cargoClient.skillConfiguration.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: created.id
    });
    expect(deleted.deletedAt).toBeTruthy();

    let listedAfterDelete = await cargoClient.skillConfiguration.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    expect(listedAfterDelete.items).toHaveLength(0);

    let fetchedAfterDelete = await cargoClient.skillConfiguration.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: created.id
    });
    expect(fetchedAfterDelete.id).toBe(created.id);
    expect(fetchedAfterDelete.deletedAt).toBeTruthy();
  });

  it('upserts the default configuration on update and resolves default by alias', async () => {
    let { tenant, environment } = await createScope();

    let initialDefault = await cargoClient.skillConfiguration.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: 'default'
    });
    expect(initialDefault).toMatchObject({
      isDefault: true,
      allowScripts: true,
      allowNonStandardDirectories: true,
      allowedFileExtensions: []
    });

    let updatedDefault = await cargoClient.skillConfiguration.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: 'default',
      allowScripts: false
    });
    expect(updatedDefault).toMatchObject({
      id: initialDefault.id,
      isDefault: true,
      allowScripts: false,
      allowNonStandardDirectories: true,
      allowedFileExtensions: []
    });

    let fetchedDefault = await cargoClient.skillConfiguration.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: 'default'
    });
    expect(fetchedDefault.id).toBe(updatedDefault.id);

    await expect(
      cargoClient.skillConfiguration.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillConfigurationId: 'default'
      })
    ).rejects.toThrow('Default skill configuration cannot be deleted');
  });

  it('hides internal configurations from lists and prevents deleting them', async () => {
    let { tenant, environment } = await createScope();

    let internal = await cargoClient.skillConfiguration.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      isInternal: true
    });

    let listed = await cargoClient.skillConfiguration.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    expect(listed.items).toHaveLength(0);

    let fetched = await cargoClient.skillConfiguration.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationId: internal.id
    });
    expect(fetched.isInternal).toBe(true);

    let fetchedMany = await cargoClient.skillConfiguration.getMany({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillConfigurationIds: [internal.id]
    });
    expect(fetchedMany).toHaveLength(1);
    expect(fetchedMany[0]!.id).toBe(internal.id);
    expect(fetchedMany[0]!.isInternal).toBe(true);

    await expect(
      cargoClient.skillConfiguration.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillConfigurationId: internal.id
      })
    ).rejects.toThrow('Internal skill configurations cannot be deleted');
  });

  it('requires restricted allowed file extensions to include markdown', async () => {
    let { tenant, environment } = await createScope();

    await expect(
      cargoClient.skillConfiguration.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        allowedFileExtensions: ['.ts']
      })
    ).rejects.toThrow('Skill configuration allowed file extensions must include .md');
  });
});
