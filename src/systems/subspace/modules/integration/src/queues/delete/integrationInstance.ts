import { createCron } from '@mtsrc/cron';
import { createQueue } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { integrationInstanceDeletedQueue } from '../lifecycle/integrationInstance';
import { getCutoffDate } from './_config';

export let integrationInstanceArchivedCleanupCron = createCron(
  {
    name: 'sub/int/cron/integrationInstanceArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await integrationInstanceDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let integrationInstanceDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/delete/integrationInstance/many',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceDeleteManyQueueProcessor =
  integrationInstanceDeleteManyQueue.process(async data => {
    let integrationInstances = await db.integrationInstance.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (integrationInstances.length === 0) return;

    await integrationInstanceDeleteQueue.addMany(
      integrationInstances.map(integrationInstance => ({
        integrationInstanceId: integrationInstance.id
      }))
    );

    let lastIntegrationInstance = integrationInstances[integrationInstances.length - 1];
    if (!lastIntegrationInstance) return;

    await integrationInstanceDeleteManyQueue.add({
      cursor: lastIntegrationInstance.id
    });
  });

export let integrationInstanceDeleteQueue = createQueue<{ integrationInstanceId: string }>({
  name: 'sub/int/delete/integrationInstance',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceDeleteQueueProcessor = integrationInstanceDeleteQueue.process(
  async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId }
    });
    if (!integrationInstance || integrationInstance.status !== 'archived') return;

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
