import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';
import { ChangeNotificationType } from '../../../prisma/generated/client';

describe('changeNotification:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns change notifications (global)', async () => {
    const {
      tenant: tenantA,
      server: serverA,
      serverVersion: versionA
    } = await f.tenant.withServerAndVersion();
    const notificationA = await f.changeNotification.serverVersionCreated({
      serverOid: serverA.oid,
      serverVersionOid: versionA.oid
    });

    const {
      tenant: tenantB,
      server: serverB,
      serverVersion: versionB
    } = await f.tenant.withServerAndVersion({
      tenantOverrides: { identifier: 'other-tenant' }
    });
    const notificationB = await f.changeNotification.serverVersionCreated({
      serverOid: serverB.oid,
      serverVersionOid: versionB.oid
    });

    const result = await shuttleClient.changeNotification.list({
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        {
          object: 'shuttle#change_notification',
          id: notificationA.id,
          type: ChangeNotificationType.public_server_version_created,
          serverId: serverA.id,
          serverVersionId: versionA.id,
          tenantId: tenantA.id,
          createdAt: notificationA.createdAt
        },
        {
          object: 'shuttle#change_notification',
          id: notificationB.id,
          type: ChangeNotificationType.public_server_version_created,
          serverId: serverB.id,
          serverVersionId: versionB.id,
          tenantId: tenantB.id,
          createdAt: notificationB.createdAt
        }
      ])
    );
  });
});

describe('changeNotification:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single change notification by ID', async () => {
    const { tenant, server, serverVersion: version } =
      await f.tenant.withServerAndVersion();
    const notification = await f.changeNotification.serverVersionCreated({
      serverOid: server.oid,
      serverVersionOid: version.oid
    });

    const result = await shuttleClient.changeNotification.get({
      changeNotificationId: notification.id
    });

    expect(result).toMatchObject({
      id: notification.id,
      type: ChangeNotificationType.public_server_version_created,
      serverId: server.id,
      serverVersionId: version.id,
      tenantId: tenant.id,
      createdAt: notification.createdAt
    });
  });
});
