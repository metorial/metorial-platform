import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { syncCallback } from '../lib/sync';
import { callbackReconcileInstanceQueue } from './definitions';
import { callbackFanoutQueue } from '../../queues/integrationReconcile';

let SWEEP_PAGE_SIZE = 250;

export let sweepDeadDeploymentCallbacksQueue = createQueue<{ cursor?: string }>({
  name: 'sub/callback/lifecycle/sweepCallbacks',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let sweepDeadDeploymentCallbacksQueueProcessor =
  sweepDeadDeploymentCallbacksQueue.process(async data => {
    let callbacks = await db.callback.findMany({
      where: {
        status: 'active',
        OR: [
          { providerDeployment: { status: { not: 'active' } } },
          { integrationProvider: { status: { not: 'active' } } }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SWEEP_PAGE_SIZE,
      select: { id: true, oid: true }
    });
    if (!callbacks.length) return;

    for (let callback of callbacks) {
      await db.callback.update({
        where: { oid: callback.oid },
        data: { status: 'archived', archivedAt: new Date() }
      });
      await db.callbackInstance.updateMany({
        where: { callbackOid: callback.oid },
        data: { isParentDeleted: true }
      });
      try {
        await syncCallback({ callbackId: callback.id, fresh: true });
      } catch {}
    }

    if (callbacks.length === SWEEP_PAGE_SIZE) {
      await sweepDeadDeploymentCallbacksQueue.add({
        cursor: callbacks[callbacks.length - 1]!.id
      });
    }
  });

export let sweepCallbackLifecycleInstancesQueue = createQueue<{ cursor?: string }>({
  name: 'sub/callback/lifecycle/sweepInstances',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let sweepCallbackLifecycleInstancesQueueProcessor =
  sweepCallbackLifecycleInstancesQueue.process(async data => {
    let rows = await db.callbackInstance.findMany({
      where: {
        status: 'attached',
        id: data.cursor ? { gt: data.cursor } : undefined,
        OR: [
          { callback: { status: { not: 'active' } } },
          { integrationInstanceProvider: { status: { not: 'active' } } },
          { integrationInstanceProvider: { isParentDeleted: true } },
          {
            integrationInstance: {
              status: { notIn: ['active', 'draft'] }
            }
          },
          { integrationInstance: { isParentDeleted: true } },
          {
            providerDeploymentConfigPair: {
              providerDeploymentVersion: {
                deployment: { status: { not: 'active' } }
              }
            }
          },
          {
            providerDeploymentConfigPair: {
              providerConfigVersion: { config: { status: { not: 'active' } } }
            }
          },
          {
            providerDeploymentConfigPair: {
              providerAuthConfigVersion: {
                authConfig: { status: { not: 'active' } }
              }
            }
          }
        ]
      },
      orderBy: { id: 'asc' },
      take: SWEEP_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) return;

    await callbackReconcileInstanceQueue.addManyWithOps(
      rows.map(row => ({
        data: { callbackInstanceId: row.id },
        opts: { id: `lifecycle:${row.id}` }
      }))
    );
    if (rows.length === SWEEP_PAGE_SIZE) {
      await sweepCallbackLifecycleInstancesQueue.add({
        cursor: rows[rows.length - 1]!.id
      });
    }
  });

export let sweepCallbackLifecycleMissingProjectionsQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/callback/lifecycle/sweepMissingProjections',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let sweepCallbackLifecycleMissingProjectionsQueueProcessor =
  sweepCallbackLifecycleMissingProjectionsQueue.process(async data => {
    let callbacks = await db.callback.findMany({
      where: {
        status: 'active',
        integrationProvider: { status: 'active', currentVersionOid: { not: null } },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SWEEP_PAGE_SIZE,
      select: { id: true }
    });
    if (!callbacks.length) return;

    await callbackFanoutQueue.addMany(
      callbacks.map(callback => ({ callbackId: callback.id }))
    );
    if (callbacks.length === SWEEP_PAGE_SIZE) {
      await sweepCallbackLifecycleMissingProjectionsQueue.add({
        cursor: callbacks[callbacks.length - 1]!.id
      });
    }
  });

export let sweepCallbackLifecycleCron = createCron(
  {
    name: 'sub/callback/lifecycle/sweep/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '*/5 * * * *'
  },
  async () => {
    await sweepDeadDeploymentCallbacksQueue.add({}, { id: 'periodic' });
    await sweepCallbackLifecycleInstancesQueue.add({}, { id: 'periodic' });
    await sweepCallbackLifecycleMissingProjectionsQueue.add({}, { id: 'periodic' });
  }
);
