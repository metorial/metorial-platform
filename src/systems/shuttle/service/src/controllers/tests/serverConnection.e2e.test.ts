import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('serverConnection:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns server connections for a tenant', async () => {
    const {
      tenant: tenantA,
      server: serverA,
      serverVersion: versionA
    } = await f.tenant.withServerAndVersion();
    const {
      tenant: tenantB,
      server: serverB,
      serverVersion: versionB
    } = await f.tenant.withServerAndVersion({
      tenantOverrides: { identifier: 'other-tenant' }
    });

    const secretA = await f.secret.serverConfigValue({ tenantOid: tenantA.oid });
    const configA = await f.serverConfig.default({
      serverOid: serverA.oid,
      secretOid: secretA.oid,
      tenantOid: tenantA.oid
    });
    const bucketA = await f.connectionLogsBucket.default();

    const connectionA1 = await f.serverConnection.default({
      serverConfigOid: configA.oid,
      serverVersionOid: versionA.oid,
      tenantOid: tenantA.oid,
      logBucketOid: bucketA.oid
    });
    const connectionA2 = await f.serverConnection.withClientInfo(
      { name: 'second-client', version: '2.0.0' },
      {
        serverConfigOid: configA.oid,
        serverVersionOid: versionA.oid,
        tenantOid: tenantA.oid,
        logBucketOid: bucketA.oid
      }
    );

    const secretB = await f.secret.serverConfigValue({ tenantOid: tenantB.oid });
    const configB = await f.serverConfig.default({
      serverOid: serverB.oid,
      secretOid: secretB.oid,
      tenantOid: tenantB.oid
    });
    const bucketB = await f.connectionLogsBucket.default();
    const connectionB = await f.serverConnection.default({
      serverConfigOid: configB.oid,
      serverVersionOid: versionB.oid,
      tenantOid: tenantB.oid,
      logBucketOid: bucketB.oid
    });

    const result = await shuttleClient.serverConnection.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: connectionA1.id,
          status: connectionA1.status,
          client: connectionA1.client,
          capabilities: connectionA1.capabilities,
          serverConfigId: configA.id,
          serverVersionId: versionA.id
        }),
        expect.objectContaining({
          id: connectionA2.id,
          status: connectionA2.status,
          client: connectionA2.client,
          capabilities: connectionA2.capabilities,
          serverConfigId: configA.id,
          serverVersionId: versionA.id
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: connectionB.id
        }
      ])
    );
  });
});

describe('serverConnection:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single server connection by ID', async () => {
    const { tenant, server, serverVersion: version } =
      await f.tenant.withServerAndVersion();
    const secret = await f.secret.serverConfigValue({ tenantOid: tenant.oid });
    const config = await f.serverConfig.default({
      serverOid: server.oid,
      secretOid: secret.oid,
      tenantOid: tenant.oid
    });
    const bucket = await f.connectionLogsBucket.default();
    const connection = await f.serverConnection.withClientInfo(
      { name: 'my-client', version: '2.0.0' },
      {
        serverConfigOid: config.oid,
        serverVersionOid: version.oid,
        tenantOid: tenant.oid,
        logBucketOid: bucket.oid
      }
    );

    const result = await shuttleClient.serverConnection.get({
      tenantId: tenant.id,
      serverConnectionId: connection.id
    });

    expect(result).toMatchObject({
      id: connection.id,
      status: connection.status,
      client: connection.client,
      capabilities: connection.capabilities,
      serverConfigId: config.id,
      serverVersionId: version.id
    });
  });

  it('rejects when server connection belongs to another tenant', async () => {
    const {
      tenant: tenantA,
      server: serverA,
      serverVersion: versionA
    } = await f.tenant.withServerAndVersion();
    const { tenant: tenantB, server: serverB, serverVersion: versionB } =
      await f.tenant.withServerAndVersion({
        tenantOverrides: { identifier: 'other-tenant' }
      });
    const secretA = await f.secret.serverConfigValue({ tenantOid: tenantA.oid });
    const configA = await f.serverConfig.default({
      serverOid: serverA.oid,
      secretOid: secretA.oid,
      tenantOid: tenantA.oid
    });
    const bucketA = await f.connectionLogsBucket.default();
    const connectionA = await f.serverConnection.default({
      serverConfigOid: configA.oid,
      serverVersionOid: versionA.oid,
      tenantOid: tenantA.oid,
      logBucketOid: bucketA.oid
    });

    const secretB = await f.secret.serverConfigValue({ tenantOid: tenantB.oid });
    const configB = await f.serverConfig.default({
      serverOid: serverB.oid,
      secretOid: secretB.oid,
      tenantOid: tenantB.oid
    });
    const bucketB = await f.connectionLogsBucket.default();
    await f.serverConnection.default({
      serverConfigOid: configB.oid,
      serverVersionOid: versionB.oid,
      tenantOid: tenantB.oid,
      logBucketOid: bucketB.oid
    });

    await expect(
      shuttleClient.serverConnection.get({
        tenantId: tenantB.id,
        serverConnectionId: connectionA.id
      })
    ).rejects.toThrow('could not be found');
  });
});

describe('serverConnection:create E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('persists enclave egress policy context', async () => {
    const { tenant, server, serverVersion } = await f.tenant.withServerAndVersion();
    const secret = await f.secret.serverConfigValue({ tenantOid: tenant.oid });
    const config = await f.serverConfig.default({
      serverOid: server.oid,
      secretOid: secret.oid,
      tenantOid: tenant.oid
    });
    const egressPolicy = {
      direction: 'egress' as const,
      entries: [{ cidr: '10.0.0.0/8', portRange: { from: 443, to: 443 } }]
    };

    const result = await shuttleClient.serverConnection.create({
      tenantId: tenant.id,
      serverConfigId: config.id,
      serverVersionId: serverVersion.id,
      enclaveId: 'enc_test',
      egressPolicy,
      client: { name: 'test-client', version: '1.0.0' },
      capabilities: {}
    });

    expect(result).toMatchObject({
      enclaveId: 'enc_test',
      egressPolicy
    });

    const persisted = await testDb.serverConnection.findUniqueOrThrow({
      where: { id: result.id }
    });
    expect(persisted.enclaveId).toBe('enc_test');
    expect(persisted.egressPolicy).toEqual(egressPolicy);
  });
});
