import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
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

    let lastProviderDeployment = providerDeployments[providerDeployments.length - 1];
    if (!lastProviderDeployment) return;

    await providerDeploymentDeleteManyQueue.add({
      cursor: lastProviderDeployment.id
    });
  });

export let providerDeploymentDeleteQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'sub/dep/delete/providerDeployment',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentBackendDeleteQueue = createQueue<{
  tenantOid: string;
  backendOid: string;
}>({
  name: 'sub/dep/delete/providerDeployment/backend',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentBackendDeleteQueueProcessor =
  providerDeploymentBackendDeleteQueue.process(async data => {
    let tenant = await db.tenant.findUnique({
      where: { oid: BigInt(data.tenantOid) }
    });
    if (!tenant) return;

    let backend = await getBackend({
      entity: { backendOid: BigInt(data.backendOid) }
    });

    await backend.deployment.deleteProviderDeployment({
      tenant
    });
  });

export let providerDeploymentDeleteQueueProcessor = providerDeploymentDeleteQueue.process(
  async data => {
    let providerDeployment = await db.providerDeployment.findUnique({
      where: { id: data.providerDeploymentId },
      include: {
        tenant: true,
        providerVariant: {
          select: {
            backendOid: true
          }
        }
      }
    });
    if (!providerDeployment || providerDeployment.status !== 'archived') return;

    await providerDeploymentBackendDeleteQueue.add({
      tenantOid: providerDeployment.tenant.oid.toString(),
      backendOid: providerDeployment.providerVariant.backendOid.toString()
    });

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
        metadata: {}
      }
    });

    await providerDeploymentDeletedQueue.add({
      providerDeploymentId: providerDeployment.id
    });
  }
);
