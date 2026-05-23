import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db } from '../db';
import { getId } from '../id';

let include = {};

class tenantServiceImpl {
  async listTenants(_d: {}) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.tenant.findMany({
            ...opts,
            include
          })
      )
    );
  }
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
    };
  }) {
    return await db.tenant.upsert({
      where: { identifier: d.input.identifier },
      update: { name: d.input.name },
      create: {
        ...getId('tenant'),
        name: d.input.name,
        identifier: d.input.identifier
      },
      include
    });
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return tenant;
  }

  async updateTenant(d: {
    tenant: { oid: bigint };
    input: {
      name?: string;
    };
  }) {
    return await db.tenant.update({
      where: { oid: d.tenant.oid },
      data: {
        ...(d.input.name && { name: d.input.name })
      },
      include
    });
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
