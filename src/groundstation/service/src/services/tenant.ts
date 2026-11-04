import { notFoundError, notImplementedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

class tenantServiceImpl {
  async upsertTenant(_d: {
    input: {
      ref: string;
      skewBoundSeconds?: number;
      backfillMaxAgeDays?: number | null;
    };
  }): Promise<Tenant> {
    throw new ServiceError(notImplementedError());
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { ref: d.id }] }
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));

    return tenant;
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
