import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getId } from '../id';

class TenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
    };
  }) {
    let { oid, id } = getId('tenant');

    return await db.tenant.upsert({
      where: {
        identifier: d.input.identifier
      },
      update: {
        name: d.input.name
      },
      create: {
        oid,
        id,
        name: d.input.name,
        identifier: d.input.identifier
      }
    });
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }]
      }
    });

    if (!tenant) throw new ServiceError(notFoundError('tenant', d.id));

    return tenant;
  }
}

export let tenantService = Service.create(
  'cargoTenantService',
  () => new TenantServiceImpl()
).build();
