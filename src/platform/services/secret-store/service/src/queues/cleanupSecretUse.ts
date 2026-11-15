import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';

let CLEANUP_SECRET_USE_BATCH_SIZE = 500;
import { subDays } from 'date-fns';
import { db } from '../db';
import { env } from '../env';

let cleanupSecretUseCron = createCron(
  {
    name: 'neb/suse/cleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await cleanupSecretUseSearchQueue.add({
      before: subDays(new Date(), 7)
    });
  }
);

let cleanupSecretUseSearchQueue = createQueue<{ before: Date; cursor?: bigint }>({
  name: 'neb/suse/cleanup/search',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let cleanupSecretUseSearchQueueProcessor = cleanupSecretUseSearchQueue.process(async data => {
  let uses = await db.secretUse.findMany({
    where: {
      ts: { lt: data.before },
      oid: data.cursor ? { lt: data.cursor } : undefined
    },
    orderBy: { oid: 'desc' },
    take: CLEANUP_SECRET_USE_BATCH_SIZE,
    select: { oid: true }
  });
  if (!uses.length) return;

  await cleanupSecretUseDeleteQueue.add({
    oids: uses.map(use => use.oid)
  });

  if (uses.length === CLEANUP_SECRET_USE_BATCH_SIZE) {
    await cleanupSecretUseSearchQueue.add(
      { before: data.before, cursor: uses[uses.length - 1]!.oid },
      dailyPacedDelay()
    );
  }
});

let cleanupSecretUseDeleteQueue = createQueue<{ oids: bigint[] }>({
  name: 'neb/suse/cleanup/delete',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

let cleanupSecretUseDeleteQueueProcessor = cleanupSecretUseDeleteQueue.process(async data => {
  await db.secretUse.deleteMany({
    where: {
      oid: { in: data.oids }
    }
  });
});

export let cleanupSecretUseProcessors = combineQueueProcessors([
  cleanupSecretUseCron,
  cleanupSecretUseSearchQueueProcessor,
  cleanupSecretUseDeleteQueueProcessor
]);
