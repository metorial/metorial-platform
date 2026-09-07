import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { callbackReconcileQueue } from './callback';
import { callbackInstanceReconcileQueue } from './callbackInstance';

export let callbackRetrySyncCron = createCron(
  {
    name: 'sub/cb/cron/retrySync',
    cron: '*/15 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await callbackRetrySyncManyQueue.add({}, { id: 'many' });
    await callbackInstanceRetrySyncManyQueue.add({}, { id: 'many' });
  }
);

export let callbackRetrySyncManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cb/rec/retrySync/callback/many',
  redisUrl: env.service.REDIS_URL
});

export let callbackRetrySyncManyQueueProcessor = callbackRetrySyncManyQueue.process(
  async data => {
    let callbacks = await db.callback.findMany({
      where: {
        status: 'active',
        syncStatus: 'failed',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, integrationProvider: { select: { id: true } } }
    });
    if (callbacks.length === 0) return;

    await callbackReconcileQueue.addManyWithOps(
      callbacks.map(callback => ({
        data: { integrationProviderId: callback.integrationProvider.id },
        opts: { id: callback.integrationProvider.id }
      }))
    );

    let last = callbacks[callbacks.length - 1];
    if (!last) return;

    await callbackRetrySyncManyQueue.add({ cursor: last.id });
  }
);

export let callbackInstanceRetrySyncManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cb/rec/retrySync/callbackInstance/many',
  redisUrl: env.service.REDIS_URL
});

export let callbackInstanceRetrySyncManyQueueProcessor =
  callbackInstanceRetrySyncManyQueue.process(async data => {
    let callbackInstances = await db.callbackInstance.findMany({
      where: {
        status: 'active',
        syncStatus: 'failed',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, integrationInstanceProvider: { select: { id: true } } }
    });
    if (callbackInstances.length === 0) return;

    await callbackInstanceReconcileQueue.addManyWithOps(
      callbackInstances.map(callbackInstance => ({
        data: {
          integrationInstanceProviderId: callbackInstance.integrationInstanceProvider.id
        },
        opts: { id: callbackInstance.integrationInstanceProvider.id }
      }))
    );

    let last = callbackInstances[callbackInstances.length - 1];
    if (!last) return;

    await callbackInstanceRetrySyncManyQueue.add({ cursor: last.id });
  });
