import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { env } from '../env';
import { requeueUnsettledSessions, type ReconcileCursor } from '../lib/state';

let pageSize = 500;

export let sessionReconcileCron = createCron(
  {
    name: 'at/session/reconcile',
    cron: '17 * * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 60_000
  },
  async () => {
    await sessionReconcileManyQueue.add({});
  }
);

export let sessionReconcileManyQueue = createQueue<{ cursor?: ReconcileCursor }>({
  name: 'at/session/reconcile/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let sessionReconcileManyProcessor = sessionReconcileManyQueue.process(async data => {
  let { next } = await requeueUnsettledSessions({
    now: new Date(),
    limit: pageSize,
    cursor: data.cursor
  });

  if (next) await sessionReconcileManyQueue.add({ cursor: next }, hourlyPacedDelay());
});

export let sessionReconcileProcessor = combineQueueProcessors([
  sessionReconcileCron,
  sessionReconcileManyProcessor
]);
