import { randomBytes } from 'crypto';
import type { PrismaClient, Tenant } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

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
        name: overrides.name ?? `Test Tenant ${identifier}`
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

  return {
    default: defaultTenant,
    withIdentifier
  };
};
