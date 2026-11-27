import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { createQueueCheckpoint } from '@lowerdeck/queue-checkpoint';
import { db } from '@metorial-subspace/db';
import { env } from '../env';
import { aggregateUsageHour, floorToHour } from '../lib/usage/rollup';

let HOUR_MS = 60 * 60 * 1000;
let MAX_BACKFILL_MS = 35 * 24 * HOUR_MS;

let checkpoint = createQueueCheckpoint({
  db,
  queue: 'sub/srev/usage/rollup',
  maxLookbackMs: MAX_BACKFILL_MS
});

export let usageRollupHourQueue = createQueue<{ hour: string }>({
  name: 'sub/srev/usage/rollup/hour',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2, limiter: { max: 2, duration: 1000 } }
});

let usageRollupCron = createCron(
  { name: 'sub/srev/usage/rollup/cron', redisUrl: env.service.REDIS_URL, cron: '5 * * * *' },
  async () => {
    let currentHour = floorToHour(new Date());
    let since = await checkpoint.since();
    let firstHour = since
      ? floorToHour(since)
      : new Date(currentHour.getTime() - MAX_BACKFILL_MS);

    let hours: { hour: string }[] = [];
    for (let t = firstHour.getTime(); t < currentHour.getTime(); t += HOUR_MS) {
      hours.push({ hour: new Date(t).toISOString() });
    }

    if (hours.length) await usageRollupHourQueue.addMany(hours);

    await checkpoint.commit(currentHour);
  }
);

let usageRollupHourProcessor = usageRollupHourQueue.process(async data => {
  await aggregateUsageHour({ hour: new Date(data.hour) });
});

export let securityReviewUsageRollupProcessors = combineQueueProcessors([
  usageRollupCron,
  usageRollupHourProcessor
]);
