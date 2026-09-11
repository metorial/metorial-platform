import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { getCutoffDate } from './_config';

export let callbackArchivedCleanupCron = createCron(
  {
    name: 'sub/cb/cron/callbackArchivedCleanup',
    cron: '15 1 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await callbackDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let callbackDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cb/delete/callback/many',
  redisUrl: env.service.REDIS_URL
});

export let callbackDeleteManyQueueProcessor = callbackDeleteManyQueue.process(async data => {
  let callbacks = await db.callback.findMany({
    where: {
      status: 'archived',
      archivedAt: { lt: getCutoffDate() },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (callbacks.length === 0) return;

  await callbackDeleteQueue.addMany(callbacks.map(callback => ({ callbackId: callback.id })));

  let last = callbacks[callbacks.length - 1];
  if (!last) return;

  await callbackDeleteManyQueue.add({ cursor: last.id });
});

export let callbackDeleteQueue = createQueue<{ callbackId: string }>({
  name: 'sub/cb/delete/callback',
  redisUrl: env.service.REDIS_URL
});

export let callbackDeleteQueueProcessor = callbackDeleteQueue.process(async data => {
  let callback = await db.callback.findUnique({
    where: { id: data.callbackId },
    select: { oid: true, status: true }
  });
  if (!callback || callback.status !== 'archived') return;

  await db.callback.update({
    where: { oid: callback.oid },
    data: { status: 'deleted' }
  });
});
