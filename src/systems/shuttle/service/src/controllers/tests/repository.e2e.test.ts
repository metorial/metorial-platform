import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('containerRepository:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns repositories for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const registryA = await f.containerRegistry.default({ tenantOid: tenantA.oid });
    const registryB = await f.containerRegistry.default({ tenantOid: tenantB.oid });
    const repositoryA1 = await f.containerRepository.default({
      registryOid: registryA.oid,
      tenantOid: tenantA.oid
    });
    const repositoryA2 = await f.containerRepository.default({
      registryOid: registryA.oid,
      tenantOid: tenantA.oid
    });
    const repositoryB = await f.containerRepository.default({
      registryOid: registryB.oid,
      tenantOid: tenantB.oid
    });

    const result = await shuttleClient.containerRepository.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: repositoryA1.id,
          type: repositoryA1.type,
          name: repositoryA1.name,
          tenantId: tenantA.id,
          registry: expect.objectContaining({ id: registryA.id })
        }),
        expect.objectContaining({
          id: repositoryA2.id,
          type: repositoryA2.type,
          name: repositoryA2.name,
          tenantId: tenantA.id,
          registry: expect.objectContaining({ id: registryA.id })
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: repositoryB.id
        }
      ])
    );
  });
});

describe('containerRepository:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single repository by ID', async () => {
    const tenant = await f.tenant.default();
    const registry = await f.containerRegistry.default({ tenantOid: tenant.oid });
    const repository = await f.containerRepository.default({
      registryOid: registry.oid,
      tenantOid: tenant.oid
    });

    const result = await shuttleClient.containerRepository.get({
      tenantId: tenant.id,
      repositoryId: repository.id
    });

    expect(result).toMatchObject({
      id: repository.id,
      type: repository.type,
      name: repository.name,
      tenantId: tenant.id,
      registry: expect.objectContaining({ id: registry.id })
    });
  });

  it('rejects when repository belongs to another tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const registryA = await f.containerRegistry.default({ tenantOid: tenantA.oid });
    const registryB = await f.containerRegistry.default({ tenantOid: tenantB.oid });
    const repositoryA = await f.containerRepository.default({
      registryOid: registryA.oid,
      tenantOid: tenantA.oid
    });
    await f.containerRepository.default({
      registryOid: registryB.oid,
      tenantOid: tenantB.oid
    });

    await expect(
      shuttleClient.containerRepository.get({
        tenantId: tenantB.id,
        repositoryId: repositoryA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
