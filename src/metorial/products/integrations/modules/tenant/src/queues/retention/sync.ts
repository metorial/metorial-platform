import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { RETENTION_BATCH_SIZE, retentionSyncWorkerOpts } from './_config';

export let tenantLogRetentionSyncSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/ret/sync/search',
  redisUrl: env.service.REDIS_URL
});

export let tenantLogRetentionSyncQueue = createQueue<{ tenantId: string }>({
  name: 'sub/ten/ret/sync/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionSyncWorkerOpts
});

export let tenantLogRetentionSyncCron = createCron(
  {
    name: 'sub/ten/ret/sync/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '5 0 * * *'
  },
  async () => {
    await tenantLogRetentionSyncSearchQueue.add({}, { id: 'tenant-retention-sync-search' });
  }
);

export let tenantLogRetentionSyncSearchQueueProcessor =
  tenantLogRetentionSyncSearchQueue.process(async data => {
    let tenants = await db.tenant.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        OR: [{ slateTenantId: { not: null } }, { shuttleTenantId: { not: null } }]
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true }
    });
    if (tenants.length === 0) return;

    await tenantLogRetentionSyncQueue.addMany(
      tenants.map(tenant => ({
        tenantId: tenant.id
      }))
    );

    await tenantLogRetentionSyncSearchQueue.add({
      cursor: tenants[tenants.length - 1]?.id
    });
  });

export let tenantLogRetentionSyncQueueProcessor = tenantLogRetentionSyncQueue.process(
  async data => {
    let tenant = await db.tenant.findUnique({
      where: { id: data.tenantId }
    });
    if (!tenant) return;

    if (tenant.slateTenantId && env.service.SLATES_HUB_URL) {
      let { slatesClient } = await import('@metorial-subspace/provider-slates');
      await slatesClient.tenant.upsert({
        identifier: tenant.slateTenantIdentifier ?? tenant.identifier,
        name: tenant.name,
        logRetentionInDays: tenant.logRetentionInDays,
        storeContent: tenant.dataRetentionLevel === 'full',
        collectErrors: tenant.collectErrors,
        storeToolCallAttachments:
          tenant.dataRetentionLevel === 'none' ? false : tenant.storeToolCallAttachments
      });
    }

    if (tenant.shuttleTenantId && env.service.SHUTTLE_URL) {
      let { shuttleClient } = await import('@metorial-subspace/provider-shuttle');
      await shuttleClient.tenant.upsert({
        identifier: tenant.shuttleTenantIdentifier ?? tenant.identifier,
        name: tenant.name,
        logRetentionInDays: tenant.logRetentionInDays,
        storeContent: tenant.dataRetentionLevel === 'full',
        collectErrors: tenant.collectErrors
      });
    }
  }
);
