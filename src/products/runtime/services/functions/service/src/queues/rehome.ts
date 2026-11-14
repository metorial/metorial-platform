import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';

let BATCH_SIZE = 500;

export let rehomeCron = createCron(
  {
    name: 'fbay/rehome/cron',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (env.provider.DEFAULT_PROVIDER !== 'knative') return;
    await rehomeManyQueue.add({});
  }
);

export let rehomeManyQueue = createQueue<{ cursor?: string }>({
  name: 'fbay/rehome/many',
  workerOpts: { concurrency: 1 },
  redisUrl: env.service.REDIS_URL
});

let rehomeManyProcessor = rehomeManyQueue.process(async data => {
  if (env.provider.DEFAULT_PROVIDER !== 'knative') return;

  let versions = await db.functionVersion.findMany({
    where: {
      status: 'active',
      runtime: { provider: { identifier: 'local' } },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: BATCH_SIZE,
    select: { id: true }
  });
  if (!versions.length) return;

  await rehomeSingleQueue.addManyWithOps(
    versions.map(version => ({
      data: { functionVersionId: version.id },
      opts: { id: version.id }
    }))
  );

  if (versions.length === BATCH_SIZE) {
    await rehomeManyQueue.add(
      { cursor: versions[versions.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

export let rehomeSingleQueue = createQueue<{ functionVersionId: string }>({
  name: 'fbay/rehome/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } },
  redisUrl: env.service.REDIS_URL
});

let rehomeSingleProcessor = rehomeSingleQueue.process(async data => {
  if (env.provider.DEFAULT_PROVIDER !== 'knative') return;

  let { rehomeLocalFunctionVersion } = await import('../providers/knative/rehome');
  await rehomeLocalFunctionVersion(data.functionVersionId);
});

export let startRehome = async () => {
  if (env.provider.DEFAULT_PROVIDER !== 'knative') return;
  await rehomeManyQueue.add({});
};

export let rehomeProcessors = combineQueueProcessors([
  rehomeCron,
  rehomeManyProcessor,
  rehomeSingleProcessor
]);
