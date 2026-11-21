import {
  commitWatermarkScan,
  createQueueCheckpoint,
  enqueueWatermarkScan,
  watermarkScanWhere,
  type WatermarkScanJob
} from '@lowerdeck/queue-checkpoint';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, pacedDelay } from '@metorial/queue';
import { isAgentTrackingEnabledForOrganization } from '../lib/flag';
import {
  backfillSyncEntityLimiter,
  backfillSyncEntityQueue,
  type EntitySyncTarget
} from './syncEntity';

let pageSize = 500;
let drainHeadroom = 2;

let pageIntervalMs =
  (pageSize / backfillSyncEntityLimiter.max) *
  backfillSyncEntityLimiter.duration *
  drainHeadroom;

let backfillCheckpoint = (d: { organizationId: string; type: EntitySyncTarget['type'] }) =>
  createQueueCheckpoint({
    db,
    queue: `agent-tracking/backfill/${d.type}/${d.organizationId}`
  });

export let backfillOrganizationQueue = createQueue<{ organizationId: string }>({
  name: 'agent-tracking/backfill/organization',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let backfillOrganizationQueueProcessor = backfillOrganizationQueue.process(
  async data => {
    let organization = await db.organization.findUnique({
      where: { id: data.organizationId }
    });
    if (!organization || organization.status != 'active') return;
    if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

    await startBackfillScan({ organizationId: organization.id, type: 'consumer' });
  }
);

export let backfillEntitiesQueue = createQueue<
  WatermarkScanJob & { organizationId: string; type: EntitySyncTarget['type'] }
>({
  name: 'agent-tracking/backfill/entities',
  workerOpts: { concurrency: 1 }
});

let startBackfillScan = async (d: {
  organizationId: string;
  type: EntitySyncTarget['type'];
}) =>
  await enqueueWatermarkScan({
    checkpoint: backfillCheckpoint(d),
    queue: backfillEntitiesQueue,
    id: `${d.type}_${d.organizationId}`,
    extra: d
  });

export let backfillEntitiesQueueProcessor = backfillEntitiesQueue.process(async job => {
  let organization = await db.organization.findUnique({ where: { id: job.organizationId } });
  if (!organization || organization.status != 'active') return;
  if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

  let where = {
    ...watermarkScanWhere(job),
    id: job.cursor ? { gt: job.cursor } : undefined
  };
  let query = { orderBy: { id: 'asc' as const }, take: pageSize, select: { id: true } };

  let rows =
    job.type == 'consumer'
      ? await db.consumer.findMany({
          ...query,
          where: { ...where, organizationOid: organization.oid }
        })
      : await db.consumerDevice.findMany({
          ...query,
          where: {
            ...where,
            status: 'active',
            instance: { organizationOid: organization.oid }
          }
        });

  if (rows.length) {
    await backfillSyncEntityQueue.addManyWithOps(
      rows.map(row => ({ data: { type: job.type, id: row.id }, opts: { id: row.id } }))
    );
  }

  if (rows.length == pageSize) {
    await backfillEntitiesQueue.add(
      { ...job, cursor: rows[rows.length - 1]!.id },
      pacedDelay({ baseMs: pageIntervalMs, jitterMs: pageIntervalMs / 10 })
    );
    return;
  }

  await commitWatermarkScan({
    checkpoint: backfillCheckpoint({ organizationId: organization.id, type: job.type }),
    job
  });

  if (job.type == 'consumer') {
    await startBackfillScan({ organizationId: organization.id, type: 'device' });
  }
});

export let backfillQueueProcessor = combineQueueProcessors([
  backfillOrganizationQueueProcessor,
  backfillEntitiesQueueProcessor
]);
