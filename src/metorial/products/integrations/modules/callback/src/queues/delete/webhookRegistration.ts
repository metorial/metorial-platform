import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../../env';
import { webhookRegistrationInclude } from '../../lib/webhookRegistrationIncludes';
import { getCutoffDate } from './_config';

export let webhookRegistrationArchivedCleanupCron = createCron(
  {
    name: 'sub/cb/cron/webhookRegistrationArchivedCleanup',
    cron: '0 1 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await webhookRegistrationDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let webhookRegistrationDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cb/delete/webhookRegistration/many',
  redisUrl: env.service.REDIS_URL
});

export let webhookRegistrationDeleteManyQueueProcessor =
  webhookRegistrationDeleteManyQueue.process(async data => {
    let webhookRegistrations = await db.webhookRegistration.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (webhookRegistrations.length === 0) return;

    await webhookRegistrationDeleteQueue.addMany(
      webhookRegistrations.map(webhookRegistration => ({
        webhookRegistrationId: webhookRegistration.id
      }))
    );

    let last = webhookRegistrations[webhookRegistrations.length - 1];
    if (!last) return;

    await webhookRegistrationDeleteManyQueue.add({ cursor: last.id });
  });

export let webhookRegistrationDeleteQueue = createQueue<{ webhookRegistrationId: string }>({
  name: 'sub/cb/delete/webhookRegistration',
  redisUrl: env.service.REDIS_URL
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
