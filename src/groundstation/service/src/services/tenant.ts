import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getCachedIngestToken, tenantCacheTag } from '../auth/tokenCache';
import { db } from '../db';
import { getId } from '../id';

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      ref: string;
      skewBoundSeconds?: number;
      backfillMaxAgeDays?: number | null;
    };
  }) {
    let settings = {
      skewBoundSeconds: d.input.skewBoundSeconds,
      backfillMaxAgeDays: d.input.backfillMaxAgeDays
    };

    let tenant = await db.tenant.upsert({
      where: { ref: d.input.ref },
      create: { ...getId('tenant'), ref: d.input.ref, ...settings },
      update: settings
    });

    await getCachedIngestToken.clearByTagAndWait(tenantCacheTag(tenant.id));

    return tenant;
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
