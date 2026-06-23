import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
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
  redisUrl: env.service.REDIS_URL
});

let cleanupSecretUseSearchQueueProcessor = cleanupSecretUseSearchQueue.process(async data => {
  let uses = await db.secretUse.findMany({
    where: {
      ts: { lt: data.before },
      oid: data.cursor ? { lt: data.cursor } : undefined
    },
    orderBy: { oid: 'desc' },
    take: 500
  });
  if (!uses.length) return;

  await cleanupSecretUseDeleteQueue.add({
    oids: uses.map(use => use.oid)
  });

  await cleanupSecretUseSearchQueue.add({
    before: data.before,
    cursor: uses[uses.length - 1]!.oid
  });
});

let cleanupSecretUseDeleteQueue = createQueue<{ oids: bigint[] }>({
  name: 'neb/suse/cleanup/delete',
  redisUrl: env.service.REDIS_URL
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
