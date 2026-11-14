import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import type { ExportStore } from '../lib/exportStore';
import { getExportStore } from '../lib/exportStore';
import { exportChunkQueue } from '../queues/exportChunk';

let pageSize = 500;

let queuedGraceMs = 60_000;

let orphanUploadAgeMs = 24 * 60 * 60_000;

export let exportReconcileCron = createCron(
  {
    name: 'at/query/export/reconcile',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 10_000
  },
  async () => {
    await exportReconcileQueue.add({});
  }
);

export let exportReconcileQueue = createQueue<{}>({
  name: 'at/query/export/reconcile/run',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Exports whose job was lost: a running lease that expired, or a queued export nobody picked up.
export let requeueStalledExports = async (now: Date) => {
  let stalled = await db.queryExport.findMany({
    where: {
      OR: [
        { status: 'running', OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        { status: 'queued', createdAt: { lt: new Date(now.getTime() - queuedGraceMs) } }
      ]
    },
    select: { id: true },
    orderBy: { oid: 'asc' },
    take: pageSize
  });

  if (stalled.length)
    await exportChunkQueue.addMany(stalled.map(record => ({ exportId: record.id })));
  return stalled.length;
};

// Cancelled and failed exports drop their upload and anything a late completion wrote.
export let cleanUpEndedExports = async (store: ExportStore) => {
  let ended = await db.queryExport.findMany({
    where: { status: { in: ['cancelled', 'failed'] }, uploadId: { not: null } },
    orderBy: { oid: 'asc' },
    take: pageSize
  });

  for (let record of ended) {
    await store.abort(record.objectKey, record.uploadId!);
    await store.delete(record.objectKey);
    await db.queryExport.updateMany({
      where: { id: record.id, uploadId: record.uploadId },
      data: { uploadId: null }
    });
  }

  return ended.length;
};

export let expireExports = async (store: ExportStore, now: Date) => {
  let expired = await db.queryExport.findMany({
    where: { status: 'completed', expiresAt: { lt: now } },
    orderBy: { oid: 'asc' },
    take: pageSize
  });

  for (let record of expired) {
    await store.delete(record.objectKey);
    await db.queryExport.updateMany({
      where: { id: record.id, status: 'completed' },
      data: { status: 'expired' }
    });
  }

  return expired.length;
};

// Uploads no active export knows about, for example started by a worker that died before it could
// record the upload id.
export let abortOrphanedUploads = async (store: ExportStore, now: Date) => {
  let uploads = (await store.listUploads('exports/')).filter(
    upload =>
      !upload.initiated || upload.initiated.getTime() < now.getTime() - orphanUploadAgeMs
  );
  if (!uploads.length) return 0;

  let known = new Set(
    (
      await db.queryExport.findMany({
        where: { uploadId: { in: uploads.map(upload => upload.uploadId) } },
        select: { uploadId: true, status: true }
      })
    )
      .filter(record => record.status == 'queued' || record.status == 'running')
      .map(record => record.uploadId)
  );

  let orphans = uploads.filter(upload => !known.has(upload.uploadId)).slice(0, pageSize);
  for (let upload of orphans) await store.abort(upload.key, upload.uploadId);

  return orphans.length;
};

export let reconcileExports = async (store: ExportStore, now = new Date()) => ({
  requeued: await requeueStalledExports(now),
  cleaned: await cleanUpEndedExports(store),
  expired: await expireExports(store, now),
  orphans: await abortOrphanedUploads(store, now)
});

export let exportReconcileProcessor = exportReconcileQueue.process(async () => {
  let store = getExportStore();
  if (!store) return;

  await reconcileExports(store);
});

export let exportReconcileProcessors = combineQueueProcessors([
  exportReconcileCron,
  exportReconcileProcessor
]);
