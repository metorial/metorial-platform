import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { subMinutes } from 'date-fns';
import { env } from '../../env';

let STOP_PROVIDER_RUNS_BATCH_SIZE = 500;

// This shouldn't happen but if a connection worker crashes while provider runs are
// active, we need to make sure they get stopped eventually. Runs created before their
// first ping have no lastPingAt, so they fall back to createdAt.
let getStaleProviderRunsWhere = () => {
  let twoMinutesAgo = subMinutes(new Date(), 2);

  return {
    status: 'running' as const,
    OR: [
      { lastPingAt: { lt: twoMinutesAgo } },
      { lastPingAt: null, createdAt: { lt: twoMinutesAgo } }
    ]
  };
};

let stopProviderRunsCron = createCron(
  {
    name: 'sub/con/prun/stop',
    cron: '40 * * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await stopProviderRunsQueue.add({}, { id: 'stop-provider-runs-root' });
  }
);

let stopProviderRunsQueue = createQueue<{ cursor?: string }>({
  name: 'sub/con/prun/stop/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let stopProviderRunsQueueProcessor = stopProviderRunsQueue.process(async data => {
  let runs = await db.providerRun.findMany({
    where: {
      ...getStaleProviderRunsWhere(),
      oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
    },
    orderBy: { oid: 'asc' },
    take: STOP_PROVIDER_RUNS_BATCH_SIZE,
    select: { oid: true }
  });
  if (!runs.length) return;

  await db.providerRun.updateMany({
    where: {
      ...getStaleProviderRunsWhere(),
      oid: { in: runs.map(run => run.oid) }
    },
    data: {
      status: 'stopped',
      completedAt: new Date()
    }
  });

  if (runs.length === STOP_PROVIDER_RUNS_BATCH_SIZE) {
    await stopProviderRunsQueue.add(
      { cursor: runs[runs.length - 1]!.oid.toString() },
      { delay: 250 }
    );
  }
});

export let stopProviderRunsQueues = combineQueueProcessors([
  stopProviderRunsCron,
  stopProviderRunsQueueProcessor
]);
