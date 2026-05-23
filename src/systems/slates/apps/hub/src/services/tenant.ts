import { notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { db } from '../db';
import { getId } from '../id';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      logRetentionInDays?: number;
    };
  }) {
    return await db.tenant.upsert({
      where: { identifier: d.input.identifier },
      update: {
        name: d.input.name,
        logRetentionInDays: d.input.logRetentionInDays
      },
      create: {
        ...getId('tenant'),
        name: d.input.name,
        identifier: d.input.identifier,
        logRetentionInDays: d.input.logRetentionInDays
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
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
