import { describe, expect, it } from 'vitest';
import { db as testDb } from '../src/db';
import { ServerDiscoveryStatus } from '../prisma/generated/client';
import { shuttleClient } from './client';
import { fixtures } from './fixtures';

describe('serverDiscovery:getForVersion E2E', () => {
  const f = fixtures(testDb);

  it('returns a server discovery for a version', async () => {
    const { tenant, server, serverVersion: version } =
      await f.tenant.withServerAndVersion();
    const secret = await f.secret.serverConfigValue({ tenantOid: tenant.oid });
    const config = await f.serverConfig.default({
      serverOid: server.oid,
      secretOid: secret.oid,
      tenantOid: tenant.oid
    });
    const discovery = await f.serverDiscovery.succeeded({
      serverConfigOid: config.oid,
      serverVersionOid: version.oid,
      tenantOid: tenant.oid
    });

    const result = await shuttleClient.serverDiscovery.getForVersion({
      tenantId: tenant.id,
      serverVersionId: version.id
    });

    expect(result).toMatchObject({
      id: discovery.id,
      status: ServerDiscoveryStatus.succeeded,
      serverConfigId: config.id,
      serverVersionId: version.id
    });
  });

  it('returns null when no discovery exists for a version', async () => {
    const { tenant, serverVersion: version } =
      await f.tenant.withServerAndVersion();

    const result = await shuttleClient.serverDiscovery.getForVersion({
      tenantId: tenant.id,
      serverVersionId: version.id
    });

    expect(result).toBeNull();
  });

  it('rejects when server version belongs to another tenant', async () => {
    const {
      tenant: tenantA,
      serverVersion: versionA
    } = await f.tenant.withServerAndVersion();
    const { tenant: tenantB } = await f.tenant.withServerAndVersion();

    await expect(
      shuttleClient.serverDiscovery.getForVersion({
        tenantId: tenantB.id,
        serverVersionId: versionA.id
      })
    ).rejects.toThrow('could not be found');
  });
});
