import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { syncCallback } from '../lib/sync';
import { callbackReconcileInstanceQueue } from './definitions';

let SWEEP_PAGE_SIZE = 250;

// The deployment/auth/integration lifecycle queues don't touch callbacks, so this
// state-driven sweep is both the cascade for archived/deleted resources and the
// retry loop for previously failed teardowns.

// Archives callbacks whose deployment is no longer active.
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
        providerDeployment: { status: { not: 'active' } },
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

      // Teardown failures are picked up by the instance sweep.
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

// Re-syncs attached instances whose callback or pair resources are no longer
// active; syncCallbackInstance unregisters and detaches them.
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
          {
            providerDeploymentConfigPair: {
              providerDeploymentVersion: { deployment: { status: { not: 'active' } } }
            }
          },
          {
            providerDeploymentConfigPair: {
              providerConfigVersion: { config: { status: { not: 'active' } } }
            }
          },
          {
            providerDeploymentConfigPair: {
              providerAuthConfigVersion: { authConfig: { status: { not: 'active' } } }
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

export let sweepCallbackLifecycleCron = createCron(
  {
    name: 'sub/callback/lifecycle/sweep/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '*/5 * * * *'
  },
  async () => {
    await sweepDeadDeploymentCallbacksQueue.add({}, { id: 'periodic' });
    await sweepCallbackLifecycleInstancesQueue.add({}, { id: 'periodic' });
  }
);
