import type {
  PrismaClient,
  ChangeNotification,
  Server,
  ServerVersion
} from '../../../prisma/generated/client';
import { ChangeNotificationType } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { ServerFixtures } from './serverFixtures';
import { ServerVersionFixtures } from './serverVersionFixtures';
import { TenantFixtures } from './tenantFixtures';

export const ChangeNotificationFixtures = (db: PrismaClient) => {
  const defaultChangeNotification = async (data: {
    serverOid?: bigint;
    serverVersionOid?: bigint;
    overrides?: Partial<ChangeNotification>;
  }): Promise<ChangeNotification> => {
    const { oid, id } = getId('changeNotification');

    const factory = defineFactory<ChangeNotification>(
      {
        oid,
        id,
        type: ChangeNotificationType.public_server_version_created,
        serverOid: data.serverOid ?? null,
        serverVersionOid: data.serverVersionOid ?? null,
        createdAt: new Date(),
        ...data.overrides
      } as ChangeNotification,
      {
        persist: value => db.changeNotification.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const serverVersionCreated = async (data: {
    serverOid: bigint;
    serverVersionOid: bigint;
    overrides?: Partial<ChangeNotification>;
  }): Promise<ChangeNotification> =>
    defaultChangeNotification({
      serverOid: data.serverOid,
      serverVersionOid: data.serverVersionOid,
      overrides: {
        type: ChangeNotificationType.public_server_version_created,
        ...data.overrides
      }
    });

  const withServerVersion = async (data?: {
    tenantOid?: bigint;
    notificationOverrides?: Partial<ChangeNotification>;
  }): Promise<
    ChangeNotification & { server: Server | null; serverVersion: ServerVersion | null }
  > => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default();
    const tenantOid = data?.tenantOid ?? tenant.oid;

    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({ tenantOid });

    const versionFixtures = ServerVersionFixtures(db);
    const version = await versionFixtures.default({
      serverOid: server.oid,
      tenantOid
    });

    const notification = await serverVersionCreated({
      serverOid: server.oid,
      serverVersionOid: version.oid,
      overrides: data?.notificationOverrides
    });

    return db.changeNotification.findUniqueOrThrow({
      where: { id: notification.id },
      include: { server: true, serverVersion: true }
    }) as Promise<
      ChangeNotification & { server: Server | null; serverVersion: ServerVersion | null }
    >;
  };

  return {
    default: defaultChangeNotification,
    serverVersionCreated,
    withServerVersion
  };
};
