import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { integrationDeletedQueue } from '../lifecycle/integration';
import { getCutoffDate } from './_config';

export let integrationArchivedCleanupCron = createCron(
  {
    name: 'sub/int/cron/integrationArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await integrationDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let integrationDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/delete/integration/many',
  redisUrl: env.service.REDIS_URL
});

export let integrationDeleteManyQueueProcessor = integrationDeleteManyQueue.process(
  async data => {
    let integrations = await db.integration.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (integrations.length === 0) return;

    await integrationDeleteQueue.addMany(
      integrations.map(integration => ({
        integrationId: integration.id
      }))
    );

    let lastIntegration = integrations[integrations.length - 1];
    if (!lastIntegration) return;

    await integrationDeleteManyQueue.add({
      cursor: lastIntegration.id
    });
  }
);

export let integrationDeleteQueue = createQueue<{ integrationId: string }>({
  name: 'sub/int/delete/integration',
  redisUrl: env.service.REDIS_URL
});

export let integrationDeleteQueueProcessor = integrationDeleteQueue.process(async data => {
  let integration = await db.integration.findUnique({
    where: { id: data.integrationId }
  });
  if (!integration || integration.status !== 'archived') return;

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
