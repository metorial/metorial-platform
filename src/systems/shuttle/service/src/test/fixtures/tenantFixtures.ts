import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  Tenant,
  Server,
  ServerVersion
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { ServerFixtures } from './serverFixtures';
import { ServerVersionFixtures } from './serverVersionFixtures';

export const TenantFixtures = (db: PrismaClient) => {
  const defaultTenant = async (overrides: Partial<Tenant> = {}): Promise<Tenant> => {
    const { oid, id } = getId('tenant');
    const identifier =
      overrides.identifier ?? `test-tenant-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Tenant>(
      {
        oid,
        id,
        identifier,
        name: overrides.name ?? `Test Tenant ${identifier}`,
        createdAt: new Date()
      } as Tenant,
      {
        persist: value => db.tenant.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  const withIdentifier = async (
    identifier: string,
    overrides: Partial<Tenant> = {}
  ): Promise<Tenant> =>
    defaultTenant({
      identifier,
      name: overrides.name ?? `Tenant ${identifier}`,
      ...overrides
    });

  const withServerAndVersion = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    serverOverrides?: Partial<Server>;
    versionOverrides?: Partial<ServerVersion>;
  }): Promise<{ tenant: Tenant; server: Server; serverVersion: ServerVersion }> => {
    const tenant = await defaultTenant(data?.tenantOverrides ?? {});
    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: tenant.oid,
      overrides: data?.serverOverrides
    });
    const serverVersionFixtures = ServerVersionFixtures(db);
    const serverVersion = await serverVersionFixtures.default({
      serverOid: server.oid,
      tenantOid: tenant.oid,
      overrides: data?.versionOverrides
    });

    return { tenant, server, serverVersion };
  };

  return {
    default: defaultTenant,
    withIdentifier,
    withServerAndVersion
  };
};
