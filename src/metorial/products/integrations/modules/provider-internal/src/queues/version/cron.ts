import { createCron } from '@lowerdeck/cron';
import { createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import {
  commitWatermarkScan,
  createQueueCheckpoint,
  isFullPassDue,
  startWatermarkScan,
  watermarkScanWhere,
  type WatermarkScanJob
} from '@lowerdeck/queue-checkpoint';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerVersionSyncSpecificationQueue } from './syncSpec';

let SYNC_VERSION_BATCH_SIZE = 500;

let checkpoint = createQueueCheckpoint({
  db,
  queue: 'sub/pint/pver/sync'
});

export let syncVersionCron = createCron(
  {
    name: 'sub/pint/pver/sync/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    await syncVersionManyCron.add(
      await startWatermarkScan({ checkpoint, full: isFullPassDue() })
    );
  }
);

let syncVersionManyCron = createQueue<WatermarkScanJob>({
  name: 'sub/pint/pver/sync/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let syncVersionManyCronProcessor = syncVersionManyCron.process(async job => {
  let versions = await db.providerVersion.findMany({
    where: {
      ...watermarkScanWhere(job),
      id: job.cursor ? { gt: job.cursor } : undefined,
      isCurrent: true
    },
    orderBy: { id: 'asc' },
    take: SYNC_VERSION_BATCH_SIZE,
    select: { id: true }
  });

  if (versions.length) {
    await syncVersionSingleCron.addManyWithOps(
      versions.map(v => ({
        data: { providerVersionId: v.id },
        opts: { id: v.id }
      }))
    );
  }

  if (versions.length === SYNC_VERSION_BATCH_SIZE) {
    await syncVersionManyCron.add(
      { ...job, cursor: versions[versions.length - 1]!.id },
      dailyPacedDelay()
    );
    return;
  }

  await commitWatermarkScan({ checkpoint, job });
});

let syncVersionSingleCron = createQueue<{ providerVersionId: string }>({
  name: 'sub/pint/pver/sync/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 25,
      duration: 1000
    }
  }
});

export let syncVersionSingleCronProcessor = syncVersionSingleCron.process(async data => {
  let version = await db.providerVersion.findFirst({
    where: { id: data.providerVersionId }
  });
  if (!version || !version.isCurrent) return;

  await providerVersionSyncSpecificationQueue.add({
    providerVersionId: data.providerVersionId
  });
});
