import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('containerRepositoryTag:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns repository tags for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const registryA = await f.containerRegistry.default({ tenantOid: tenantA.oid });
    const registryB = await f.containerRegistry.default({ tenantOid: tenantB.oid });
    const repositoryA = await f.containerRepository.default({
      registryOid: registryA.oid,
      tenantOid: tenantA.oid
    });
    const repositoryB = await f.containerRepository.default({
      registryOid: registryB.oid,
      tenantOid: tenantB.oid
    });
    const tagA1 = await f.containerRepositoryTag.default({
      repositoryOid: repositoryA.oid,
      tenantOid: tenantA.oid
    });
    const tagA2 = await f.containerRepositoryTag.default({
      repositoryOid: repositoryA.oid,
      tenantOid: tenantA.oid
    });
    const tagB = await f.containerRepositoryTag.default({
      repositoryOid: repositoryB.oid,
      tenantOid: tenantB.oid
    });

    const result = await shuttleClient.containerRepositoryTag.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: tagA1.id,
          type: tagA1.type,
          name: tagA1.name,
          tenantId: tenantA.id,
          repository: expect.objectContaining({ id: repositoryA.id }),
          currentVersion: null
        }),
        expect.objectContaining({
          id: tagA2.id,
          type: tagA2.type,
          name: tagA2.name,
          tenantId: tenantA.id,
          repository: expect.objectContaining({ id: repositoryA.id }),
          currentVersion: null
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: tagB.id
        }
      ])
    );
  });
});

describe('containerRepositoryTag:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single repository tag by ID', async () => {
    const tenant = await f.tenant.default();
    const registry = await f.containerRegistry.default({ tenantOid: tenant.oid });
    const repository = await f.containerRepository.default({
      registryOid: registry.oid,
      tenantOid: tenant.oid
    });
    const tag = await f.containerRepositoryTag.default({
      repositoryOid: repository.oid,
      tenantOid: tenant.oid
    });

    const result = await shuttleClient.containerRepositoryTag.get({
      tenantId: tenant.id,
      repositoryTagId: tag.id
    });

    expect(result).toMatchObject({
      id: tag.id,
      type: tag.type,
      name: tag.name,
      tenantId: tenant.id,
      repository: expect.objectContaining({ id: repository.id }),
      currentVersion: null
    });
  });

  it('rejects when repository tag belongs to another tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const registryA = await f.containerRegistry.default({ tenantOid: tenantA.oid });
    const registryB = await f.containerRegistry.default({ tenantOid: tenantB.oid });
    const repositoryA = await f.containerRepository.default({
      registryOid: registryA.oid,
      tenantOid: tenantA.oid
    });
    const repositoryB = await f.containerRepository.default({
      registryOid: registryB.oid,
      tenantOid: tenantB.oid
    });
    const tagA = await f.containerRepositoryTag.default({
      repositoryOid: repositoryA.oid,
      tenantOid: tenantA.oid
    });
    await f.containerRepositoryTag.default({
      repositoryOid: repositoryB.oid,
      tenantOid: tenantB.oid
    });

    await expect(
      shuttleClient.containerRepositoryTag.get({
        tenantId: tenantB.id,
        repositoryTagId: tagA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
