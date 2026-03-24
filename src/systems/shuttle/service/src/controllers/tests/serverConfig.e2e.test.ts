import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('serverConfig:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns server instances for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');

    const secretA1 = await f.secret.serverConfigValue({ tenantOid: tenantA.oid });
    const secretA2 = await f.secret.serverConfigValue({ tenantOid: tenantA.oid });
    const serverA = await f.server.default({ tenantOid: tenantA.oid });
    const configA1 = await f.serverConfig.default({
      serverOid: serverA.oid,
      secretOid: secretA1.oid,
      tenantOid: tenantA.oid
    });
    const configA2 = await f.serverConfig.default({
      serverOid: serverA.oid,
      secretOid: secretA2.oid,
      tenantOid: tenantA.oid
    });

    const secretB = await f.secret.serverConfigValue({ tenantOid: tenantB.oid });
    const serverB = await f.server.default({ tenantOid: tenantB.oid });
    const configB = await f.serverConfig.default({
      serverOid: serverB.oid,
      secretOid: secretB.oid,
      tenantOid: tenantB.oid
    });

    const result = await shuttleClient.serverConfig.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: configA1.id,
          serverId: serverA.id,
          tenantId: tenantA.id
        }),
        expect.objectContaining({
          id: configA2.id,
          serverId: serverA.id,
          tenantId: tenantA.id
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: configB.id
        }
      ])
    );
  });
});

describe('serverConfig:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single server instance by ID', async () => {
    const tenant = await f.tenant.default();
    const secret = await f.secret.serverConfigValue({ tenantOid: tenant.oid });
    const server = await f.server.default({ tenantOid: tenant.oid });
    const config = await f.serverConfig.default({
      serverOid: server.oid,
      secretOid: secret.oid,
      tenantOid: tenant.oid
    });

    const result = await shuttleClient.serverConfig.get({
      tenantId: tenant.id,
      serverConfigId: config.id
    });

    expect(result).toMatchObject({
      id: config.id,
      serverId: server.id,
      tenantId: tenant.id
    });
  });

  it('rejects when server config belongs to another tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const secretA = await f.secret.serverConfigValue({ tenantOid: tenantA.oid });
    const serverA = await f.server.default({ tenantOid: tenantA.oid });
    const configA = await f.serverConfig.default({
      serverOid: serverA.oid,
      secretOid: secretA.oid,
      tenantOid: tenantA.oid
    });

    const secretB = await f.secret.serverConfigValue({ tenantOid: tenantB.oid });
    const serverB = await f.server.default({ tenantOid: tenantB.oid });
    await f.serverConfig.default({
      serverOid: serverB.oid,
      secretOid: secretB.oid,
      tenantOid: tenantB.oid
    });

    await expect(
      shuttleClient.serverConfig.get({
        tenantId: tenantB.id,
        serverConfigId: configA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
