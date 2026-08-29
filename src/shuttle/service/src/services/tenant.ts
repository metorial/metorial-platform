import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      logRetentionInDays?: number;
      storeContent?: boolean;
      collectErrors?: boolean;
    };
  }) {
    return await db.tenant.upsert({
      where: { identifier: d.input.identifier },
      update: {
        name: d.input.name,
        logRetentionInDays: d.input.logRetentionInDays,
        storeContent: d.input.storeContent,
        collectErrors: d.input.collectErrors
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('tenant'),
        name: d.input.name,
        identifier: d.input.identifier,
        logRetentionInDays: d.input.logRetentionInDays,
        storeContent: d.input.storeContent ?? true,
        collectErrors: d.input.collectErrors ?? true
      }
    });
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] }
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return tenant;
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
