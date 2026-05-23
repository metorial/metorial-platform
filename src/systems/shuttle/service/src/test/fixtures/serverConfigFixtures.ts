import type {
  PrismaClient,
  ServerConfig,
  Server,
  Secret,
  Tenant
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { ServerFixtures } from './serverFixtures';
import { SecretFixtures } from './secretFixtures';
import { TenantFixtures } from './tenantFixtures';

export const ServerConfigFixtures = (db: PrismaClient) => {
  const defaultServerConfig = async (data: {
    serverOid: bigint;
    secretOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerConfig>;
  }): Promise<ServerConfig> => {
    const { oid, id } = getId('serverConfig');

    const factory = defineFactory<ServerConfig>(
      {
        oid,
        id,
        secretOid: data.secretOid,
        serverOid: data.serverOid,
        tenantOid: data.tenantOid,
        createdAt: new Date(),
        ...data.overrides
      } as ServerConfig,
      {
        persist: value => db.serverConfig.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withServer = async (data: {
    tenantOid: bigint;
    serverOverrides?: Partial<Server>;
    configOverrides?: Partial<ServerConfig>;
  }): Promise<ServerConfig & { server: Server; secret: Secret }> => {
    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: data.tenantOid,
      overrides: data.serverOverrides
    });

    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.serverConfigValue({
      tenantOid: data.tenantOid
    });

    const config = await defaultServerConfig({
      serverOid: server.oid,
      secretOid: secret.oid,
      tenantOid: data.tenantOid,
      overrides: data.configOverrides
    });

    return db.serverConfig.findUniqueOrThrow({
      where: { id: config.id },
      include: { server: true, secret: true }
    }) as Promise<ServerConfig & { server: Server; secret: Secret }>;
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    serverOverrides?: Partial<Server>;
    configOverrides?: Partial<ServerConfig>;
  }): Promise<ServerConfig & { server: Server; secret: Secret; tenant: Tenant }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: tenant.oid,
      overrides: data?.serverOverrides
    });

    const secretFixtures = SecretFixtures(db);
    const secret = await secretFixtures.serverConfigValue({
      tenantOid: tenant.oid
    });

    const config = await defaultServerConfig({
      serverOid: server.oid,
      secretOid: secret.oid,
      tenantOid: tenant.oid,
      overrides: data?.configOverrides
    });

    return db.serverConfig.findUniqueOrThrow({
      where: { id: config.id },
      include: { server: true, secret: true, tenant: true }
    }) as Promise<ServerConfig & { server: Server; secret: Secret; tenant: Tenant }>;
  };

  return {
    default: defaultServerConfig,
    withServer,
    withTenant
  };
};
