import { notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      identifier: string;
    };
  }) {
    return await db.tenant.upsert({
      where: { identifier: d.input.identifier },
      update: {},
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('tenant'),
        identifier: d.input.identifier
      }
    });
  }

  async getTenantById(d: { id: string }) {
    let tenant = await this.getTenantByIdSafe(d);
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return tenant;
  }

  async getTenantByIdSafe(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] }
    });
    return tenant ?? undefined;
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
