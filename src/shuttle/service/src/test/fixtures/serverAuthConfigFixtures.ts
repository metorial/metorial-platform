import type {
  PrismaClient,
  ServerAuthConfig,
  Server,
  Tenant
} from '../../../prisma/generated/client';
import { ServerAuthConfigType } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { ServerFixtures } from './serverFixtures';
import { TenantFixtures } from './tenantFixtures';

export const ServerAuthConfigFixtures = (db: PrismaClient) => {
  const defaultServerAuthConfig = async (data: {
    serverOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerAuthConfig>;
  }): Promise<ServerAuthConfig> => {
    const { oid, id } = getId('serverAuthConfig');

    const factory = defineFactory<ServerAuthConfig>(
      {
        oid,
        id,
        type: data.overrides?.type ?? ServerAuthConfigType.remote,
        serverOid: data.serverOid,
        tenantOid: data.tenantOid,
        credentialsOid: data.overrides?.credentialsOid ?? null,
        remoteOAuthConnectionOid: data.overrides?.remoteOAuthConnectionOid ?? null,
        remoteOAuthConnectionAuthTokenOid:
          data.overrides?.remoteOAuthConnectionAuthTokenOid ?? null,
        delegatedOAuthConnectionOid: data.overrides?.delegatedOAuthConnectionOid ?? null,
        delegatedOAuthConnectionAuthTokenOid:
          data.overrides?.delegatedOAuthConnectionAuthTokenOid ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data.overrides
      } as ServerAuthConfig,
      {
        persist: value => db.serverAuthConfig.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withServer = async (data: {
    tenantOid: bigint;
    serverOverrides?: Partial<Server>;
    authConfigOverrides?: Partial<ServerAuthConfig>;
  }): Promise<ServerAuthConfig & { server: Server }> => {
    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: data.tenantOid,
      overrides: data.serverOverrides
    });

    const authConfig = await defaultServerAuthConfig({
      serverOid: server.oid,
      tenantOid: data.tenantOid,
      overrides: data.authConfigOverrides
    });

    return db.serverAuthConfig.findUniqueOrThrow({
      where: { id: authConfig.id },
      include: { server: true }
    }) as Promise<ServerAuthConfig & { server: Server }>;
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    serverOverrides?: Partial<Server>;
    authConfigOverrides?: Partial<ServerAuthConfig>;
  }): Promise<ServerAuthConfig & { tenant: Tenant; server: Server }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: tenant.oid,
      overrides: data?.serverOverrides
    });

    const authConfig = await defaultServerAuthConfig({
      serverOid: server.oid,
      tenantOid: tenant.oid,
      overrides: data?.authConfigOverrides
    });

    return db.serverAuthConfig.findUniqueOrThrow({
      where: { id: authConfig.id },
      include: { tenant: true, server: true }
    }) as Promise<ServerAuthConfig & { tenant: Tenant; server: Server }>;
  };

  return {
    default: defaultServerAuthConfig,
    withServer,
    withTenant
  };
};
