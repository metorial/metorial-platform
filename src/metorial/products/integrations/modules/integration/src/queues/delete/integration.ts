import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { enqueueCallbackReconcileForIntegration } from '@metorial-subspace/module-callback/src/queues/reconcile/callback';
import { env } from '../../env';
import { integrationDeletedQueue } from '../lifecycle/integration';

let integrationArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/int/cron/integrationArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/int/delete/integration/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.integration.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => integrationDeleteQueue.addMany(ids.map(id => ({ integrationId: id })))
});

export let integrationArchivedCleanupCron = integrationArchivedCleanup.cron;
export let integrationDeleteManyQueue = integrationArchivedCleanup.manyQueue;
export let integrationDeleteManyQueueProcessor = integrationArchivedCleanup.manyProcessor;

export let integrationDeleteQueue = createQueue<{ integrationId: string }>({
  name: 'sub/int/delete/integration',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
});

export let integrationDeleteQueueProcessor = integrationDeleteQueue.process(async data => {
  let integration = await db.integration.findUnique({
    where: { id: data.integrationId }
  });
  if (!integration || integration.status !== 'archived') return;

  await db.adapterIntegrationInstanceProvider.updateMany({
    where: { integrationOid: integration.oid, status: { not: 'deleted' } },
    data: { status: 'deleted' }
  });
  await db.adapterIntegrationInstance.updateMany({
    where: { integrationOid: integration.oid, status: { not: 'deleted' } },
    data: { status: 'deleted' }
  });
  await db.adapterIntegrationProvider.updateMany({
    where: { integrationOid: integration.oid, status: { not: 'deleted' } },
    data: { status: 'deleted' }
  });
  await db.adapterIntegration.updateMany({
    where: { integrationOid: integration.oid, status: { not: 'deleted' } },
    data: { status: 'deleted' }
  });

  let activeCallbacks = await db.callback.count({
    where: { integrationOid: integration.oid, status: 'active' }
  });
  if (activeCallbacks) {
    await enqueueCallbackReconcileForIntegration({ integrationId: integration.id });
    throw new QueueRetryError();
  }

  await db.integrationProvider.updateMany({
    where: { integrationOid: integration.oid, status: 'active' },
    data: {
      status: 'archived',
      archivedAt: integration.archivedAt ?? new Date(),
      name: '[deleted]',
      description: null,
      metadata: {}
    }
  });

  await db.integration.updateMany({
    where: { oid: integration.oid },
    data: {
      status: 'deleted',
      name: '[deleted]',
      description: null,
      metadata: {},
      privateMetadata: {}
    }
  });

  await integrationDeletedQueue.add({ integrationId: integration.id });
});
