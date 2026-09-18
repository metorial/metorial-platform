import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { enqueueCallbackInstanceReconcileForIntegrationInstance } from '@metorial-subspace/module-callback/src/queues/reconcile/callbackInstance';
import { env } from '../../env';
import { integrationInstanceDeletedQueue } from '../lifecycle/integrationInstance';

let integrationInstanceArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/int/cron/integrationInstanceArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/int/delete/integrationInstance/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.integrationInstance.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => integrationInstanceDeleteQueue.addMany(ids.map(id => ({ integrationInstanceId: id })))
});

export let integrationInstanceArchivedCleanupCron = integrationInstanceArchivedCleanup.cron;
export let integrationInstanceDeleteManyQueue = integrationInstanceArchivedCleanup.manyQueue;
export let integrationInstanceDeleteManyQueueProcessor = integrationInstanceArchivedCleanup.manyProcessor;

export let integrationInstanceDeleteQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/delete/integrationInstance',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
});

export let integrationInstanceDeleteQueueProcessor = integrationInstanceDeleteQueue.process(
  async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (!integrationInstance || integrationInstance.status !== 'archived') return;

    await db.adapterIntegrationInstanceProvider.updateMany({
      where: {
        integrationInstanceOid: integrationInstance.oid,
        status: { not: 'deleted' }
      },
      data: { status: 'deleted' }
    });
    await db.adapterIntegrationInstance.updateMany({
      where: {
        integrationInstanceOid: integrationInstance.oid,
        status: { not: 'deleted' }
      },
      data: { status: 'deleted' }
    });

    let activeCallbackInstances = await db.callbackInstance.count({
      where: { integrationInstanceOid: integrationInstance.oid, status: 'active' }
    });
    if (activeCallbackInstances) {
      await enqueueCallbackInstanceReconcileForIntegrationInstance({
        integrationInstanceId: integrationInstance.id
      });
      throw new QueueRetryError();
    }

    await db.integrationInstanceProvider.updateMany({
      where: { integrationInstanceOid: integrationInstance.oid, status: { not: 'deleted' } },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await db.integrationInstance.updateMany({
      where: { oid: integrationInstance.oid },
      data: {
        status: 'deleted',
        name: '[deleted]',
        description: null,
        metadata: {},
        privateMetadata: {}
      }
    });

    await integrationInstanceDeletedQueue.add({
      integrationInstanceId: integrationInstance.id
    });
  }
);
