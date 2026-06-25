import type {
  PrismaClient,
  ServerDiscovery,
  ServerConfig,
  ServerVersion
} from '../../../prisma/generated/client';
import { ServerDiscoveryStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { ServerConfigFixtures } from './serverConfigFixtures';
import { ServerVersionFixtures } from './serverVersionFixtures';

export const ServerDiscoveryFixtures = (db: PrismaClient) => {
  const defaultServerDiscovery = async (data: {
    serverConfigOid: bigint;
    serverVersionOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerDiscovery>;
  }): Promise<ServerDiscovery> => {
    const { oid, id } = getId('serverDiscovery');

    const factory = defineFactory<ServerDiscovery>(
      {
        oid,
        id,
        status: ServerDiscoveryStatus.pending,
        connectionOid: data.overrides?.connectionOid ?? null,
        specificationOid: data.overrides?.specificationOid ?? null,
        serverConfigOid: data.serverConfigOid,
        serverVersionOid: data.serverVersionOid,
        serverAuthConfigOid: data.overrides?.serverAuthConfigOid ?? null,
        tenantOid: data.tenantOid,
        createdAt: new Date(),
        ...data.overrides
      } as ServerDiscovery,
      {
        persist: value => db.serverDiscovery.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withStatus = async (
    status: ServerDiscoveryStatus,
    data: {
      serverConfigOid: bigint;
      serverVersionOid: bigint;
      tenantOid: bigint;
      overrides?: Partial<ServerDiscovery>;
    }
  ): Promise<ServerDiscovery> =>
    defaultServerDiscovery({
      ...data,
      overrides: {
        ...data.overrides,
        status
      }
    });

  const succeeded = async (data: {
    serverConfigOid: bigint;
    serverVersionOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerDiscovery>;
  }): Promise<ServerDiscovery> => withStatus(ServerDiscoveryStatus.succeeded, data);

  const failed = async (data: {
    serverConfigOid: bigint;
    serverVersionOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerDiscovery>;
  }): Promise<ServerDiscovery> => withStatus(ServerDiscoveryStatus.failed, data);

  const withDependencies = async (data: {
    tenantOid: bigint;
    status?: ServerDiscoveryStatus;
    discoveryOverrides?: Partial<ServerDiscovery>;
  }): Promise<
    ServerDiscovery & { serverConfig: ServerConfig; serverVersion: ServerVersion }
  > => {
    const configFixtures = ServerConfigFixtures(db);
    const config = await configFixtures.withServer({ tenantOid: data.tenantOid });

    const versionFixtures = ServerVersionFixtures(db);
    const version = await versionFixtures.default({
      serverOid: config.serverOid,
      tenantOid: data.tenantOid
    });

    const discovery = await defaultServerDiscovery({
      serverConfigOid: config.oid,
      serverVersionOid: version.oid,
      tenantOid: data.tenantOid,
      overrides: {
        status: data.status ?? ServerDiscoveryStatus.pending,
        ...data.discoveryOverrides
      }
    });

    return db.serverDiscovery.findUniqueOrThrow({
      where: { id: discovery.id },
      include: { serverConfig: true, serverVersion: true }
    }) as Promise<
      ServerDiscovery & { serverConfig: ServerConfig; serverVersion: ServerVersion }
    >;
  };

  return {
    default: defaultServerDiscovery,
    withStatus,
    succeeded,
    failed,
    withDependencies
  };
};
