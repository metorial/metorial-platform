import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('containerRepositoryVersion:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns repository versions for a tenant', async () => {
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
    const versionA1 = await f.containerRepositoryVersion.default({
      repositoryOid: repositoryA.oid,
      tenantOid: tenantA.oid
    });
    const versionA2 = await f.containerRepositoryVersion.default({
      repositoryOid: repositoryA.oid,
      tenantOid: tenantA.oid
    });
    const versionB = await f.containerRepositoryVersion.default({
      repositoryOid: repositoryB.oid,
      tenantOid: tenantB.oid
    });

    const result = await shuttleClient.containerRepositoryVersion.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: versionA1.id,
          digest: versionA1.digest,
          tenantId: tenantA.id,
          repository: expect.objectContaining({ id: repositoryA.id })
        }),
        expect.objectContaining({
          id: versionA2.id,
          digest: versionA2.digest,
          tenantId: tenantA.id,
          repository: expect.objectContaining({ id: repositoryA.id })
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: versionB.id
        }
      ])
    );
  });
});

describe('containerRepositoryVersion:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single repository version by ID', async () => {
    const tenant = await f.tenant.default();
    const registry = await f.containerRegistry.default({ tenantOid: tenant.oid });
    const repository = await f.containerRepository.default({
      registryOid: registry.oid,
      tenantOid: tenant.oid
    });
    const version = await f.containerRepositoryVersion.default({
      repositoryOid: repository.oid,
      tenantOid: tenant.oid
    });

    const result = await shuttleClient.containerRepositoryVersion.get({
      tenantId: tenant.id,
      repositoryVersionId: version.id
    });

    expect(result).toMatchObject({
      id: version.id,
      digest: version.digest,
      tenantId: tenant.id,
      repository: expect.objectContaining({ id: repository.id })
    });
  });

  it('rejects when repository version belongs to another tenant', async () => {
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
    const versionA = await f.containerRepositoryVersion.default({
      repositoryOid: repositoryA.oid,
      tenantOid: tenantA.oid
    });
    await f.containerRepositoryVersion.default({
      repositoryOid: repositoryB.oid,
      tenantOid: tenantB.oid
    });

    await expect(
      shuttleClient.containerRepositoryVersion.get({
        tenantId: tenantB.id,
        repositoryVersionId: versionA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
