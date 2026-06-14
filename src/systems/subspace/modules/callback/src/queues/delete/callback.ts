import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { getCutoffDate } from './_config';

export let callbackArchivedCleanupCron = createCron(
  {
    name: 'sub/callback/cron/callbackArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await callbackDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let callbackDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/callback/delete/callback/many',
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

  await callbackDeleteQueue.addMany(
    callbacks.map(callback => ({
      callbackId: callback.id
    }))
  );

  let lastCallback = callbacks[callbacks.length - 1];
  if (!lastCallback) return;

  await callbackDeleteManyQueue.add({
    cursor: lastCallback.id
  });
});

export let callbackDeleteQueue = createQueue<{ callbackId: string }>({
  name: 'sub/callback/delete/callback',
  redisUrl: env.service.REDIS_URL
});

export let callbackDeleteQueueProcessor = callbackDeleteQueue.process(async data => {
  let callback = await db.callback.findUnique({
    where: { id: data.callbackId }
  });
  if (!callback || callback.status !== 'archived') return;

  await db.callbackInstance.updateMany({
    where: { callbackOid: callback.oid },
    data: { isParentDeleted: true }
  });

  await db.callbackProviderTrigger.deleteMany({
    where: { callbackOid: callback.oid }
  });

  await db.callbackDestinationLink.deleteMany({
    where: { callbackOid: callback.oid }
  });

  await db.callback.updateMany({
    where: { oid: callback.oid },
    data: {
      status: 'deleted',
      name: '[deleted]',
      description: null,
      metadata: {},
      pollIntervalSecondsOverride: null
    }
  });
});
