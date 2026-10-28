import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';

let pageSize = 500;

let cleanupQueue = createQueue<{ cursor?: string }>({
  name: 'ares/two-factor/cleanup',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1, limiter: { max: 1, duration: 1000 } }
});

let processor = cleanupQueue.process(async d => {
  let rows = await db.userTwoFactorSetup.findMany({
    where: { expiresAt: { lt: new Date() }, ...(d.cursor ? { id: { gt: d.cursor } } : {}) },
    orderBy: { id: 'asc' },
    take: pageSize,
    select: { id: true }
  });
  if (!rows.length) return;

  await db.userTwoFactorSetup.deleteMany({
    where: { id: { in: rows.map(row => row.id) }, expiresAt: { lt: new Date() } }
  });
  if (rows.length === pageSize)
    await cleanupQueue.add({ cursor: rows[rows.length - 1]!.id }, hourlyPacedDelay());
});

let cron = createCron(
  { name: 'ares/two-factor/cleanup/cron', cron: '0 * * * *', redisUrl: env.service.REDIS_URL },
  async () => {
    await cleanupQueue.add({});
  }
);

export let twoFactorCleanupProcessor = combineQueueProcessors([processor, cron]);
