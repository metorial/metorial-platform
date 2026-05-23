import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  ServerVersion,
  Server,
  Tenant
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { ServerFixtures } from './serverFixtures';
import { ServerDeploymentFixtures } from './serverDeploymentFixtures';
import { TenantFixtures } from './tenantFixtures';

export const ServerVersionFixtures = (db: PrismaClient) => {
  const defaultServerVersion = async (data: {
    serverOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerVersion>;
  }): Promise<ServerVersion> => {
    const { oid, id } = getId('serverVersion');
    const identifier =
      data.overrides?.identifier ?? `v1.0.${randomBytes(2).toString('hex')}`;
    const deploymentFixtures = ServerDeploymentFixtures(db);
    const deployment =
      data.overrides?.deploymentOid ??
      (await deploymentFixtures.default({
        serverOid: data.serverOid,
        tenantOid: data.tenantOid
      })).oid;

    const factory = defineFactory<ServerVersion>(
      {
        oid,
        id,
        isCurrent: data.overrides?.isCurrent ?? false,
        identifier,
        configSchema: data.overrides?.configSchema ?? {
          type: 'object',
          properties: {}
        },
        configTransformer: data.overrides?.configTransformer ?? '$.config',
        remoteUrl: data.overrides?.remoteUrl ?? null,
        remoteProtocol: data.overrides?.remoteProtocol ?? null,
        serverOid: data.serverOid,
        repositoryTagOid: data.overrides?.repositoryTagOid ?? null,
        repositoryVersionOid: data.overrides?.repositoryVersionOid ?? null,
        functionServerOid: data.overrides?.functionServerOid ?? null,
        deploymentOid: data.overrides?.deploymentOid ?? deployment,
        tenantOid: data.tenantOid,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data.overrides
      } as ServerVersion,
      {
        persist: value => db.serverVersion.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const currentVersion = async (data: {
    serverOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerVersion>;
  }): Promise<ServerVersion> =>
    defaultServerVersion({
      ...data,
      overrides: {
        ...data.overrides,
        isCurrent: true
      }
    });

  const withServer = async (data: {
    tenantOid: bigint;
    serverOverrides?: Partial<Server>;
    versionOverrides?: Partial<ServerVersion>;
  }): Promise<ServerVersion & { server: Server }> => {
    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: data.tenantOid,
      overrides: data.serverOverrides
    });

    const version = await defaultServerVersion({
      serverOid: server.oid,
      tenantOid: data.tenantOid,
      overrides: data.versionOverrides
    });

    return db.serverVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: { server: true }
    }) as Promise<ServerVersion & { server: Server }>;
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    serverOverrides?: Partial<Server>;
    versionOverrides?: Partial<ServerVersion>;
  }): Promise<ServerVersion & { server: Server; tenant: Tenant }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: tenant.oid,
      overrides: data?.serverOverrides
    });

    const version = await defaultServerVersion({
      serverOid: server.oid,
      tenantOid: tenant.oid,
      overrides: data?.versionOverrides
    });

    return db.serverVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: { server: true, tenant: true }
    }) as Promise<ServerVersion & { server: Server; tenant: Tenant }>;
  };

  return {
    default: defaultServerVersion,
    currentVersion,
    withServer,
    withTenant
  };
};
