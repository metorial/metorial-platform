import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('serverAuthConfig:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns server auth configs for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const serverA = await f.server.default({ tenantOid: tenantA.oid });
    const serverB = await f.server.default({ tenantOid: tenantB.oid });

    const authA1 = await f.serverAuthConfig.default({
      serverOid: serverA.oid,
      tenantOid: tenantA.oid
    });
    const authA2 = await f.serverAuthConfig.default({
      serverOid: serverA.oid,
      tenantOid: tenantA.oid
    });
    const authB = await f.serverAuthConfig.default({
      serverOid: serverB.oid,
      tenantOid: tenantB.oid
    });

    const result = await shuttleClient.serverAuthConfig.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: authA1.id,
          type: authA1.type,
          serverId: serverA.id,
          tenantId: tenantA.id,
          credentials: null,
          profile: null
        }),
        expect.objectContaining({
          id: authA2.id,
          type: authA2.type,
          serverId: serverA.id,
          tenantId: tenantA.id,
          credentials: null,
          profile: null
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: authB.id
        }
      ])
    );
  });
});

describe('serverAuthConfig:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single server auth config by ID', async () => {
    const tenant = await f.tenant.default();
    const server = await f.server.default({ tenantOid: tenant.oid });
    const authConfig = await f.serverAuthConfig.default({
      serverOid: server.oid,
      tenantOid: tenant.oid
    });

    const result = await shuttleClient.serverAuthConfig.get({
      tenantId: tenant.id,
      serverAuthConfigId: authConfig.id
    });

    expect(result).toMatchObject({
      id: authConfig.id,
      type: authConfig.type,
      serverId: server.id,
      tenantId: tenant.id,
      credentials: null,
      profile: null
    });
  });

  it('rejects when server auth config belongs to another tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const serverA = await f.server.default({ tenantOid: tenantA.oid });
    const serverB = await f.server.default({ tenantOid: tenantB.oid });
    const authConfigA = await f.serverAuthConfig.default({
      serverOid: serverA.oid,
      tenantOid: tenantA.oid
    });
    await f.serverAuthConfig.default({
      serverOid: serverB.oid,
      tenantOid: tenantB.oid
    });

    await expect(
      shuttleClient.serverAuthConfig.get({
        tenantId: tenantB.id,
        serverAuthConfigId: authConfigA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
