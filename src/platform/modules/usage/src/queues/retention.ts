import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { USAGE_RETENTION_MS } from '../constants';

let pageSize = 500;

export let usageRetentionQueue = createQueue<{ cutoff: string }>({
  name: 'usage/retention',
  workerOpts: { concurrency: 1, limiter: { max: 1, duration: 1000 } }
});

export let usageRetentionProcessor = usageRetentionQueue.process(async data => {
  let rows = await db.usageMetric.findMany({
    where: { ts: { lt: new Date(data.cutoff) } },
    take: pageSize,
    select: { key: true }
  });
  if (!rows.length) return;

  await db.usageMetric.deleteMany({ where: { key: { in: rows.map(row => row.key) } } });

  if (rows.length === pageSize) await usageRetentionQueue.add(data, dailyPacedDelay());
});

export let usageRetentionCron = createCron(
  { name: 'usage/retention/cron', cron: '17 * * * *' },
  async () => {
    await usageRetentionQueue.add({
      cutoff: new Date(Date.now() - USAGE_RETENTION_MS).toISOString()
    });
  }
);

export let usageRetentionProcessors = combineQueueProcessors([
  usageRetentionCron,
  usageRetentionProcessor
]);
