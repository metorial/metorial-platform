import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { subDays } from 'date-fns';

export let ARCHIVED_CLEANUP_RETENTION_DAYS = 14;

export let ARCHIVED_CLEANUP_BATCH_SIZE = 500;

export let getCutoffDate = () => subDays(new Date(), ARCHIVED_CLEANUP_RETENTION_DAYS);

export let archivedCleanupWorkerOpts = (limiter?: { max: number; duration: number }) => ({
  concurrency: 5,
  limiter: limiter ?? { max: 10, duration: 1000 }
});

export let createArchivedCleanupScan = (d: {
  cronName: string;
  cron?: string;
  manyQueueName: string;
  redisUrl: string;

  findArchived: (args: { cursor?: string; take: number }) => Promise<{ id: string }[]>;
  enqueue: (ids: string[]) => Promise<void>;
}) => {
  let manyQueue = createQueue<{ cursor?: string }>({
    name: d.manyQueueName,
    redisUrl: d.redisUrl,
    workerOpts: { concurrency: 1 }
  });

  let cron = createCron(
    { name: d.cronName, cron: d.cron ?? '0 0 * * *', redisUrl: d.redisUrl },
    async () => {
      await manyQueue.add({}, { id: 'many' });
    }
  );

  let manyProcessor = manyQueue.process(async data => {
    let rows = await d.findArchived({
      cursor: data.cursor,
      take: ARCHIVED_CLEANUP_BATCH_SIZE
    });
    if (rows.length === 0) return;

    await d.enqueue(rows.map(row => row.id));

    if (rows.length === ARCHIVED_CLEANUP_BATCH_SIZE) {
      await manyQueue.add({ cursor: rows[rows.length - 1]!.id }, dailyPacedDelay());
    }
  });

  return {
    cron,
    manyQueue,
    manyProcessor,
    processors: combineQueueProcessors([cron, manyProcessor])
  };
};

// The cursor/order/select half of the scan, identical in every copy.
export let archivedCleanupFindArgs = (d: { cursor?: string; take: number }) => ({
  orderBy: { id: 'asc' as const },
  take: d.take,
  select: { id: true }
});

export let archivedCleanupWhere = (d: { cursor?: string }) => ({
  status: 'archived' as const,
  archivedAt: { lt: getCutoffDate() },
  ...(d.cursor ? { id: { gt: d.cursor } } : {})
});
