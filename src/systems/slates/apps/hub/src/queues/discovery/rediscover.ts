import { createCron } from '@mtsrc/cron';
import { createQueue } from '@mtsrc/queue';
import { subDays } from 'date-fns';
import { db } from '../../db';
import { env } from '../../env';
import { discoverSlateQueue } from './discover';

export let rediscoverSlatesCron = createCron(
  {
    name: 'shub/rds/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '*/15 * * * *'
  },
  async () => {
    await rediscoverSlatesQueue.add({});
  }
);

let rediscoverSlatesQueue = createQueue<{ cursor?: string }>({
  name: 'shub/rds/many',
  redisUrl: env.service.REDIS_URL
});

export let rediscoverSlatesQueueProcessor = rediscoverSlatesQueue.process(async data => {
  let oneDayAgo = subDays(new Date(), 1);

  let versions = await db.slateVersion.findMany({
    where: {
      OR: [{ lastDiscoveredAt: null }, { lastDiscoveredAt: { lt: oneDayAgo } }],
      id: data.cursor ? { gt: data.cursor } : undefined,
      status: { in: ['active', 'pending', 'discovering', 'discovery_failed'] }
    },
    take: 100,
    orderBy: { id: 'asc' },
    select: { id: true }
  });
  if (versions.length === 0) return;

  await rediscoverSlateQueue.addMany(
    versions.map(v => ({
      slateVersionId: v.id
    }))
  );

  await rediscoverSlatesQueue.add({
    cursor: versions[versions.length - 1]?.id
  });
});

let rediscoverSlateQueue = createQueue<{ slateVersionId: string }>({
  name: 'shub/rds/sing',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    limiter: {
      max: 5,
      duration: 60_000
    },
    concurrency: 5
  }
});

export let rediscoverSlateQueueProcessor = rediscoverSlateQueue.process(async data => {
  await discoverSlateQueue.add(
    { versionId: data.slateVersionId },
    { id: data.slateVersionId }
  );
});
