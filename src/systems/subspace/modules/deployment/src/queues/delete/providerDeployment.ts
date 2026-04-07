import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerDeploymentDeletedQueue } from '../lifecycle/providerDeployment';
import { getCutoffDate } from './_config';

export let providerDeploymentArchivedCleanupCron = createCron(
  {
    name: 'sub/dep/cron/providerDeploymentArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await providerDeploymentDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let providerDeploymentDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/dep/delete/providerDeployment/many',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentDeleteManyQueueProcessor =
  providerDeploymentDeleteManyQueue.process(async data => {
    let providerDeployments = await db.providerDeployment.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providerDeployments.length === 0) return;

    await providerDeploymentDeleteQueue.addMany(
      providerDeployments.map(providerDeployment => ({
        providerDeploymentId: providerDeployment.id
      }))
    );

    await providerDeploymentDeleteManyQueue.add({
      cursor: providerDeployments[providerDeployments.length - 1].id
    });
  });

export let providerDeploymentDeleteQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/delete/providerDeployment',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentDeleteQueueProcessor = providerDeploymentDeleteQueue.process(
  async data => {
    let providerDeployment = await db.providerDeployment.findUnique({
      where: { id: data.providerDeploymentId }
    });
    if (!providerDeployment || providerDeployment.status !== 'archived') return;

    await db.sessionProvider.updateMany({
      where: { deploymentOid: providerDeployment.oid },
      data: { status: 'deleted', isParentDeleted: true }
    });

    await db.sessionTemplateProvider.updateMany({
      where: { deploymentOid: providerDeployment.oid },
      data: { status: 'deleted' }
    });

    await db.providerDeployment.updateMany({
      where: { oid: providerDeployment.oid },
      data: {
        status: 'deleted',
        isDefault: false,
        defaultConfigOid: null,
        defaultAuthConfigOid: null,
        name: '[deleted]',
        description: null,
        metadata: {},
        networkingRulesetIds: []
      }
    });

    await providerDeploymentDeletedQueue.add({
      providerDeploymentId: providerDeployment.id
    });
  }
);
