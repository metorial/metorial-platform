import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let createScope = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-skills',
    name: 'Tenant Skills'
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

describe('cargo skill.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates, lists, gets, updates, and deletes skills with linked stores', async () => {
    let { tenant, environment } = await createScope();

    let created = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Support'
    });

    let listed = await cargoClient.skill.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let fetched = await cargoClient.skill.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id
    });

    let linkedStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeId
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      storeId: expect.any(String),
      store: {
        id: expect.any(String),
        name: 'Support',
        itemCount: 0
      }
    });
    expect(linkedStore).toMatchObject({
      id: created.storeId,
      name: 'Support'
    });
    expect(listed.items).toHaveLength(1);
    expect(fetched.id).toBe(created.id);
    expect(fetched.store.id).toBe(created.storeId);

    let updated = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id,
      name: 'Customer Support'
    });

    let updatedStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeId
    });

    expect(updated).toMatchObject({
      id: created.id,
      storeId: created.storeId,
      store: {
        id: created.storeId,
        name: 'Customer Support'
      }
    });
    expect(updatedStore.name).toBe('Customer Support');

    await expect(
      cargoClient.store.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: created.storeId
      })
    ).rejects.toThrow('Cannot delete store: it is linked to a skill');

    let deleted = await cargoClient.skill.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id
    });

    let listedAfterDelete = await cargoClient.skill.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let deletedSkill = await db.skill.findUnique({
      where: {
        id: created.id
      }
    });
    let deletedStore = await db.store.findUnique({
      where: {
        id: created.storeId
      }
    });

    expect(deleted.id).toBe(created.id);
    expect(deleted.storeId).toBe(created.storeId);
    expect(listedAfterDelete.items).toHaveLength(0);
    expect(deletedSkill).toBeNull();
    expect(deletedStore).toBeNull();
  });
});
