import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerVersionSyncSpecificationQueue } from './syncSpec';

export let syncVersionCron = createCron(
  {
    name: 'sub/pint/pver/sync/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    await syncVersionManyCron.add({});
  }
);

let syncVersionManyCron = createQueue<{ cursor?: string }>({
  name: 'sub/pint/pver/sync/many',
  redisUrl: env.service.REDIS_URL
});

export let syncVersionManyCronProcessor = syncVersionManyCron.process(async data => {
  let versions = await db.providerVersion.findMany({
    where: {
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (!versions.length) return;

  await syncVersionSingleCron.addMany(
    versions.map(v => ({
      providerVersionId: v.id
    }))
  );

  await syncVersionManyCron.add({
    cursor: versions[versions.length - 1]!.id
  });
});

let syncVersionSingleCron = createQueue<{ providerVersionId: string }>({
  name: 'sub/pint/pver/sync/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 10,
      duration: 60 * 1000
    }
  }
});

export let syncVersionSingleCronProcessor = syncVersionSingleCron.process(async data => {
  await providerVersionSyncSpecificationQueue.add({
    providerVersionId: data.providerVersionId
  });
});
