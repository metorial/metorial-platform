import { describe, expect, it } from 'vitest';
import { db as testDb } from '../src/db';
import { ChangeNotificationType } from '../prisma/generated/client';
import { shuttleClient } from './client';
import { fixtures } from './fixtures';

describe('changeNotification:list E2E', () => {
  const f = fixtures(testDb);

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
    } = await f.tenant.withServerAndVersion();
    const notificationB = await f.changeNotification.serverVersionCreated({
      serverOid: serverB.oid,
      serverVersionOid: versionB.oid
    });

    let result = await shuttleClient.changeNotification.list({
      limit: 100,
      order: 'desc'
    });

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
