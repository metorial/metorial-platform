import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../../env';
import { webhookRegistrationInclude } from '../../lib/webhookRegistrationIncludes';

let webhookRegistrationArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/cb/cron/webhookRegistrationArchivedCleanup',
  cron: '0 1 * * *',
  manyQueueName: 'sub/cb/delete/webhookRegistration/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.webhookRegistration.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => webhookRegistrationDeleteQueue.addMany(ids.map(id => ({ webhookRegistrationId: id })))
});

export let webhookRegistrationArchivedCleanupCron = webhookRegistrationArchivedCleanup.cron;
export let webhookRegistrationDeleteManyQueue = webhookRegistrationArchivedCleanup.manyQueue;
export let webhookRegistrationDeleteManyQueueProcessor = webhookRegistrationArchivedCleanup.manyProcessor;

export let webhookRegistrationDeleteQueue = createQueue<{ webhookRegistrationId: string }>({
  name: 'sub/cb/delete/webhookRegistration',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
});

export let webhookRegistrationDeleteQueueProcessor = webhookRegistrationDeleteQueue.process(
  async data => {
    let webhookRegistration = await db.webhookRegistration.findUnique({
      where: { id: data.webhookRegistrationId },
      include: { ...webhookRegistrationInclude, tenant: true }
    });
    if (!webhookRegistration || webhookRegistration.status === 'deleted') return;

    let backend = await getBackend({ entity: webhookRegistration.providerVariant });

    await backend.callbacks?.deleteWebhookRegistration({
      tenant: webhookRegistration.tenant,
      webhookRegistration
    });

    await db.webhookRegistration.update({
      where: { oid: webhookRegistration.oid },
      data: { status: 'deleted' }
    });
  }
);
