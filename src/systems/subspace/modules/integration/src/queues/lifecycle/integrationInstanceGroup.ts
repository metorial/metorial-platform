import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import {
  archiveIntegrationInstanceGroupSessionTemplatesQueue,
  syncIntegrationInstanceGroupSessionTemplatesQueue
} from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { env } from '../../env';
import { integrationInstanceGroupProviderSetQueue } from './integrationInstanceGroupProvider';

export let runIntegrationInstanceGroupArchivedEffects = async (d: {
  integrationInstanceGroupId: string;
  integrationInstanceGroupOid: bigint;
  archivedAt: Date;
}) => {
  await db.integrationInstanceGroupSource.updateMany({
    where: {
      integrationInstanceGroupOid: d.integrationInstanceGroupOid,
      status: 'active'
    },
    data: {
      status: 'archived',
      archivedAt: d.archivedAt
    }
  });

  await archiveIntegrationInstanceGroupSessionTemplatesQueue.add({
    integrationInstanceGroupId: d.integrationInstanceGroupId
  });

  await integrationInstanceGroupArchiveProvidersManyQueue.add({
    integrationInstanceGroupId: d.integrationInstanceGroupId
  });
};

export let integrationInstanceGroupArchiveProvidersManyQueue = createQueue<{
  integrationInstanceGroupId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationInstanceGroup/archiveProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceGroupArchiveProvidersManyQueueProcessor =
  integrationInstanceGroupArchiveProvidersManyQueue.process(async data => {
    let integrationInstanceGroup = await db.integrationInstanceGroup.findUnique({
      where: { id: data.integrationInstanceGroupId }
    });
    if (!integrationInstanceGroup || integrationInstanceGroup.status !== 'archived') {
      return;
    }

    let providers = await db.integrationInstanceGroupProvider.findMany({
      where: {
        integrationInstanceGroupOid: integrationInstanceGroup.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { oid: true, id: true }
    });
    if (providers.length === 0) return;

    await db.integrationInstanceGroupProvider.updateMany({
      where: {
        oid: { in: providers.map(provider => provider.oid) }
      },
      data: {
        status: 'archived',
        archivedAt: integrationInstanceGroup.archivedAt ?? new Date()
      }
    });

    await integrationInstanceGroupProviderSetQueue.addMany(
      providers.map(provider => ({
        integrationInstanceGroupId: data.integrationInstanceGroupId,
        integrationInstanceGroupProviderId: provider.id
      }))
    );

    let lastProvider = providers[providers.length - 1];
    if (!lastProvider) return;

    await integrationInstanceGroupArchiveProvidersManyQueue.add({
      integrationInstanceGroupId: data.integrationInstanceGroupId,
      cursor: lastProvider.id
    });
  });

export let integrationInstanceGroupCreatedQueue = createQueue<{
  integrationInstanceGroupId: string;
}>({
  name: 'sub/int/lc/integrationInstanceGroup/created',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceGroupCreatedQueueProcessor =
  integrationInstanceGroupCreatedQueue.process(async data => {
    await syncIntegrationInstanceGroupSessionTemplatesQueue.add({
      integrationInstanceGroupId: data.integrationInstanceGroupId
    });
  });

export let integrationInstanceGroupUpdatedQueue = createQueue<{
  integrationInstanceGroupId: string;
}>({
  name: 'sub/int/lc/integrationInstanceGroup/updated',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceGroupUpdatedQueueProcessor =
  integrationInstanceGroupUpdatedQueue.process(async data => {
    await syncIntegrationInstanceGroupSessionTemplatesQueue.add({
      integrationInstanceGroupId: data.integrationInstanceGroupId
    });
  });

export let integrationInstanceGroupArchivedQueue = createQueue<{
  integrationInstanceGroupId: string;
}>({
  name: 'sub/int/lc/integrationInstanceGroup/archived',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceGroupArchivedQueueProcessor =
  integrationInstanceGroupArchivedQueue.process(async data => {
    let integrationInstanceGroup = await db.integrationInstanceGroup.findUnique({
      where: { id: data.integrationInstanceGroupId }
    });
    if (!integrationInstanceGroup || integrationInstanceGroup.status !== 'archived') {
      return;
    }

    await runIntegrationInstanceGroupArchivedEffects({
      integrationInstanceGroupId: data.integrationInstanceGroupId,
      integrationInstanceGroupOid: integrationInstanceGroup.oid,
      archivedAt: integrationInstanceGroup.archivedAt ?? new Date()
    });
  });
