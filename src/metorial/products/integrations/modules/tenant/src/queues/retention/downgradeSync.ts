import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { retentionLevelsLessStrictThan } from '../../lib/retentionLevel';
import { RETENTION_BATCH_SIZE, retentionSyncWorkerOpts } from './_config';

export let tenantSessionRetentionDowngradeSyncQueue = createQueue<{ tenantId: string }>({
  name: 'sub/ten/ret/downgrade/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionSyncWorkerOpts
});

let ratchetActiveSessions = async (d: { tenantOid: bigint; where: any; data: any }) => {
  while (true) {
    let sessions = await db.session.findMany({
      where: { tenantOid: d.tenantOid, status: 'active', ...d.where },
      take: RETENTION_BATCH_SIZE,
      select: { oid: true }
    });
    if (sessions.length === 0) return;

    await db.session.updateMany({
      where: { oid: { in: sessions.map(session => session.oid) } },
      data: d.data
    });

    if (sessions.length < RETENTION_BATCH_SIZE) return;
  }
};

export let tenantSessionRetentionDowngradeSyncQueueProcessor =
  tenantSessionRetentionDowngradeSyncQueue.process(async data => {
    let tenant = await db.tenant.findUnique({
      where: { id: data.tenantId },
      select: {
        oid: true,
        dataRetentionLevel: true,
        collectErrors: true,
        storeToolCallAttachments: true
      }
    });
    if (!tenant) return;

    let laxerLevels = retentionLevelsLessStrictThan(tenant.dataRetentionLevel);
    if (laxerLevels.length > 0) {
      await ratchetActiveSessions({
        tenantOid: tenant.oid,
        where: { dataRetentionLevel: { in: laxerLevels } },
        data: { dataRetentionLevel: tenant.dataRetentionLevel }
      });
    }

    if (tenant.collectErrors === false) {
      await ratchetActiveSessions({
        tenantOid: tenant.oid,
        where: { collectErrors: true },
        data: { collectErrors: false }
      });
    }

    if (tenant.storeToolCallAttachments === false) {
      await ratchetActiveSessions({
        tenantOid: tenant.oid,
        where: { storeToolCallAttachments: true },
        data: { storeToolCallAttachments: false }
      });
    }
  });
