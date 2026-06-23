import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { upsertRegistry } from '../registry';

let include = { tenant: true };

class registryServiceImpl {
  async getRegistryById(d: { id: string; tenant?: Tenant }) {
    let registry = await db.registry.findFirst({
      where: {
        status: 'active',

        AND: [
          {
            OR: d.tenant ? [{ tenantOid: d.tenant.oid }, { tenantOid: null }] : undefined
          },
          {
            OR: [{ id: d.id }, { identifier: d.id }]
          }
        ].filter(Boolean)
      },
      include
    });
    if (!registry) throw new ServiceError(notFoundError('registry'));
    return registry;
  }

  async listRegistries(d: { tenant?: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.registry.findMany({
            ...opts,
            where: {
              OR: d.tenant ? [{ tenantOid: d.tenant.oid }, { tenantOid: null }] : undefined,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async listAllRegistries(_d: { tenant?: Tenant }) {
    return db.registry.findMany({
      where: {
        status: 'active'
      },
      include
    });
  }

  async getManyRegistriesByIds(d: { ids: string[]; tenant?: Tenant }) {
    return db.registry.findMany({
      where: {
        status: 'active',
        AND: [
          {
            OR: d.tenant ? [{ tenantOid: d.tenant.oid }, { tenantOid: null }] : undefined
          },
          {
            id: { in: d.ids }
          }
        ].filter(Boolean)
      },
      include
    });
  }

  async createRegistry(d: { registryUrl: string; name?: string }) {
    await upsertRegistry(d);
  }
}

export let registryService = Service.create(
  'registryService',
  () => new registryServiceImpl()
).build();
