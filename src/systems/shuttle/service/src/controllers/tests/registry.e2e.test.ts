import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('containerRegistry:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns registries for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');

    const registryA1 = await f.containerRegistry.default({ tenantOid: tenantA.oid });
    const registryA2 = await f.containerRegistry.default({ tenantOid: tenantA.oid });
    const registryB = await f.containerRegistry.default({ tenantOid: tenantB.oid });

    const result = await shuttleClient.containerRegistry.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: registryA1.id,
          type: registryA1.type,
          name: registryA1.name,
          url: registryA1.url,
          tenantId: tenantA.id
        }),
        expect.objectContaining({
          id: registryA2.id,
          type: registryA2.type,
          name: registryA2.name,
          url: registryA2.url,
          tenantId: tenantA.id
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: registryB.id
        }
      ])
    );
  });
});

describe('containerRegistry:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single registry by ID', async () => {
    const tenant = await f.tenant.default();
    const registry = await f.containerRegistry.default({ tenantOid: tenant.oid });

    const result = await shuttleClient.containerRegistry.get({
      tenantId: tenant.id,
      registryId: registry.id
    });

    expect(result).toMatchObject({
      id: registry.id,
      type: registry.type,
      name: registry.name,
      url: registry.url,
      tenantId: tenant.id
    });
  });

  it('rejects when registry belongs to another tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const registryA = await f.containerRegistry.default({ tenantOid: tenantA.oid });
    await f.containerRegistry.default({ tenantOid: tenantB.oid });

    await expect(
      shuttleClient.containerRegistry.get({
        tenantId: tenantB.id,
        registryId: registryA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
