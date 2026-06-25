import { randomBytes } from 'crypto';
import { defineFactory } from '@lowerdeck/testing-tools';
import { getId, type PrismaClient, type Tenant } from '@metorial-subspace/db';

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
        urlKey: overrides.urlKey ?? identifier,
        name: overrides.name ?? `Test Tenant ${identifier}`
      } as Tenant,
      {
        persist: value => db.tenant.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  return {
    default: defaultTenant
  };
};
