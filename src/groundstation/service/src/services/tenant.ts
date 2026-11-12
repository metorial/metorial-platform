import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getCachedIngestToken, tenantCacheTag } from '../auth/tokenCache';
import { db } from '../db';
import { getId } from '../id';
import { eraseTenantRecordsQueue, storeCollections } from '../queues';
import { isStoreConfigured } from '../store/connection';
import type { Tenant } from '../../prisma/generated/client';

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      ref: string;
      skewBoundSeconds?: number;
      backfillMaxAgeDays?: number | null;
      recordRetentionDays?: number;
      contentRetentionDays?: number;
    };
  }) {
    let settings = {
      skewBoundSeconds: d.input.skewBoundSeconds,
      backfillMaxAgeDays: d.input.backfillMaxAgeDays,
      recordRetentionDays: d.input.recordRetentionDays,
      contentRetentionDays: d.input.contentRetentionDays
    };

    let tenant = await db.tenant.upsert({
      where: { ref: d.input.ref },
      create: { ...getId('tenant'), ref: d.input.ref, ...settings },
      update: settings
    });

    await getCachedIngestToken.clearByTagAndWait(tenantCacheTag(tenant.id));

    return tenant;
  }

  async eraseRecords(d: { tenant: Tenant }) {
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'No record store is configured.' })
      );
    }

    await eraseTenantRecordsQueue.addMany(
      storeCollections.map(collection => ({ tenantId: d.tenant.id, collection }))
    );
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
