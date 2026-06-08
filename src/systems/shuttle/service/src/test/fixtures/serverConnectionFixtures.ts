import type {
  PrismaClient,
  ServerConnection,
  ServerConfig,
  ServerVersion
} from '../../../prisma/generated/client';
import { ServerConnectionStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { ConnectionLogsBucketFixtures } from './connectionLogsBucketFixtures';
import { ServerConfigFixtures } from './serverConfigFixtures';
import { ServerVersionFixtures } from './serverVersionFixtures';

export const ServerConnectionFixtures = (db: PrismaClient) => {
  const defaultServerConnection = async (data: {
    serverConfigOid: bigint;
    serverVersionOid: bigint;
    tenantOid: bigint;
    logBucketOid: bigint;
    overrides?: Partial<ServerConnection>;
  }): Promise<ServerConnection> => {
    const { oid, id } = getId('serverConnection');

    const factory = defineFactory<ServerConnection>(
      {
        oid,
        id,
        status: ServerConnectionStatus.connected,
        isLogsInStorage: false,
        logBucketOid: data.logBucketOid,
        client: {
          name: 'test-client',
          version: '1.0.0'
        },
        capabilities: {
          roots: {},
          sampling: {}
        },
        serverConfigOid: data.serverConfigOid,
        serverVersionOid: data.serverVersionOid,
        serverAuthConfigOid: data.overrides?.serverAuthConfigOid ?? null,
        serverInstanceConfigurationOid: data.overrides?.serverInstanceConfigurationOid ?? null,
        tenantOid: data.tenantOid,
        createdAt: new Date(),
        lastPingAt: null,
        ...data.overrides
      } as ServerConnection,
      {
        persist: value => db.serverConnection.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withClientInfo = async (
    clientInfo: { name: string; version: string },
    data: {
      serverConfigOid: bigint;
      serverVersionOid: bigint;
      tenantOid: bigint;
      logBucketOid: bigint;
      overrides?: Partial<ServerConnection>;
    }
  ): Promise<ServerConnection> =>
    defaultServerConnection({
      ...data,
      overrides: {
        ...data.overrides,
        client: clientInfo
      }
    });

  const withDependencies = async (data: {
    tenantOid: bigint;
    clientInfo?: { name: string; version: string };
    connectionOverrides?: Partial<ServerConnection>;
  }): Promise<
    ServerConnection & { serverConfig: ServerConfig; serverVersion: ServerVersion }
  > => {
    const configFixtures = ServerConfigFixtures(db);
    const config = await configFixtures.withServer({ tenantOid: data.tenantOid });

    const versionFixtures = ServerVersionFixtures(db);
    const version = await versionFixtures.default({
      serverOid: config.serverOid,
      tenantOid: data.tenantOid
    });

    const bucketFixtures = ConnectionLogsBucketFixtures(db);
    const bucket = await bucketFixtures.default();

    const connection = await defaultServerConnection({
      serverConfigOid: config.oid,
      serverVersionOid: version.oid,
      tenantOid: data.tenantOid,
      logBucketOid: bucket.oid,
      overrides: {
        client: data.clientInfo ?? { name: 'test-client', version: '1.0.0' },
        ...data.connectionOverrides
      }
    });

    return db.serverConnection.findUniqueOrThrow({
      where: { id: connection.id },
      include: { serverConfig: true, serverVersion: true }
    }) as Promise<
      ServerConnection & { serverConfig: ServerConfig; serverVersion: ServerVersion }
    >;
  };

  return {
    default: defaultServerConnection,
    withClientInfo,
    withDependencies
  };
};
