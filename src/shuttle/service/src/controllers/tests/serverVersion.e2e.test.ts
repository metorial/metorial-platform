import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('serverVersion:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns server versions for a tenant', async () => {
    const {
      tenant: tenantA,
      server: serverA,
      serverVersion: versionA1
    } = await f.tenant.withServerAndVersion();
    const { tenant: tenantB, serverVersion: versionB } =
      await f.tenant.withServerAndVersion({
        tenantOverrides: { identifier: 'other-tenant' }
      });
    const versionA2 = await f.serverVersion.default({
      serverOid: serverA.oid,
      tenantOid: tenantA.oid
    });

    const result = await shuttleClient.serverVersion.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: versionA1.id,
          isCurrent: versionA1.isCurrent,
          serverId: serverA.id,
          tenantId: tenantA.id,
          configSchema: versionA1.configSchema,
          configTransformer: versionA1.configTransformer
        }),
        expect.objectContaining({
          id: versionA2.id,
          isCurrent: versionA2.isCurrent,
          serverId: serverA.id,
          tenantId: tenantA.id,
          configSchema: versionA2.configSchema,
          configTransformer: versionA2.configTransformer
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

describe('serverVersion:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single server version by ID', async () => {
    const { tenant, server, serverVersion: version } =
      await f.tenant.withServerAndVersion();

    const result = await shuttleClient.serverVersion.get({
      tenantId: tenant.id,
      serverVersionId: version.id
    });

    expect(result).toMatchObject({
      id: version.id,
      isCurrent: version.isCurrent,
      serverId: server.id,
      tenantId: tenant.id,
      configSchema: version.configSchema,
      configTransformer: version.configTransformer,
      repositoryTag: null,
      repositoryVersion: null
    });
  });

  it('rejects when server version belongs to another tenant', async () => {
    const { tenant: tenantA, serverVersion: versionA } =
      await f.tenant.withServerAndVersion();
    const { tenant: tenantB } = await f.tenant.withServerAndVersion({
      tenantOverrides: { identifier: 'other-tenant' }
    });

    await expect(
      shuttleClient.serverVersion.get({
        tenantId: tenantB.id,
        serverVersionId: versionA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
