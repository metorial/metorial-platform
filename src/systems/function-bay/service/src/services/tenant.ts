import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = {};

let defaultTenantById = new Map<string, Tenant>();
let defaultTenantByIdentifier = new Map<string, Tenant>();

let cacheDefaultTenant = (tenant: Tenant) => {
  if (!tenant.isServiceDefault) return;

  defaultTenantById.set(tenant.id, tenant);
  defaultTenantByIdentifier.set(tenant.identifier, tenant);
};

let getCachedDefaultTenant = (idOrIdentifier: string) =>
  defaultTenantById.get(idOrIdentifier) ?? defaultTenantByIdentifier.get(idOrIdentifier);

let getTenantFromDb = createLocallyCachedFunction({
  getHash: (id: string) => id,
  provider: async (id: string) => {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id }, { identifier: id }] },
      include
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));

    if (tenant.isServiceDefault) cacheDefaultTenant(tenant);

    return tenant;
  },
  ttlSeconds: 60
});

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      isServiceDefault?: boolean;
      hasAutomaticEnclaveOverride?: boolean;
    };
  }) {
    let tenant = await db.tenant.upsert({
      where: { identifier: d.input.identifier },
      update: {
        name: d.input.name,
        isServiceDefault: d.input.isServiceDefault,
        hasAutomaticEnclaveOverride: d.input.hasAutomaticEnclaveOverride
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('tenant'),
        name: d.input.name,
        identifier: d.input.identifier,
        isServiceDefault: d.input.isServiceDefault,
        hasAutomaticEnclaveOverride: d.input.hasAutomaticEnclaveOverride
      },
      include
    });

    cacheDefaultTenant(tenant);

    return tenant;
  }

  async getTenantById(d: { id: string }) {
    let cachedDefault = getCachedDefaultTenant(d.id);
    if (cachedDefault) return cachedDefault;

    return await getTenantFromDb(d.id);
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
