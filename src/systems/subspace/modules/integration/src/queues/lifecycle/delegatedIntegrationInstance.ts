import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import {
  archiveDelegatedIntegrationInstanceSessionTemplatesQueue,
  syncDelegatedIntegrationInstanceSessionTemplatesQueue
} from '@metorial-subspace/module-session/src/queues/lifecycle/linkedDelegatedIntegrationTemplate';
import { env } from '../../env';
import { delegatedIntegrationInstanceProviderSetQueue } from './delegatedIntegrationInstanceProvider';

export let runDelegatedIntegrationInstanceArchivedEffects = async (d: {
  delegatedIntegrationInstanceId: string;
  delegatedIntegrationInstanceOid: bigint;
  archivedAt: Date;
}) => {
  await db.delegatedIntegrationInstanceSource.updateMany({
    where: {
      delegatedIntegrationInstanceOid: d.delegatedIntegrationInstanceOid,
      status: 'active'
    },
    data: {
      status: 'archived',
      archivedAt: d.archivedAt
    }
  });

  await archiveDelegatedIntegrationInstanceSessionTemplatesQueue.add({
    delegatedIntegrationInstanceId: d.delegatedIntegrationInstanceId
  });

  await delegatedIntegrationInstanceArchiveProvidersManyQueue.add({
    delegatedIntegrationInstanceId: d.delegatedIntegrationInstanceId
  });
};

export let delegatedIntegrationInstanceArchiveProvidersManyQueue = createQueue<{
  delegatedIntegrationInstanceId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/delegatedIntegrationInstance/archiveProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let delegatedIntegrationInstanceArchiveProvidersManyQueueProcessor =
  delegatedIntegrationInstanceArchiveProvidersManyQueue.process(async data => {
    let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.findUnique({
      where: { id: data.delegatedIntegrationInstanceId }
    });
    if (!delegatedIntegrationInstance || delegatedIntegrationInstance.status !== 'archived') {
      return;
    }

    let providers = await db.delegatedIntegrationInstanceProvider.findMany({
      where: {
        delegatedIntegrationInstanceOid: delegatedIntegrationInstance.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { oid: true, id: true }
    });
    if (providers.length === 0) return;

    await db.delegatedIntegrationInstanceProvider.updateMany({
      where: {
        oid: { in: providers.map(provider => provider.oid) }
      },
      data: {
        status: 'archived',
        archivedAt: delegatedIntegrationInstance.archivedAt ?? new Date()
      }
    });

    await delegatedIntegrationInstanceProviderSetQueue.addMany(
      providers.map(provider => ({
        delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId,
        delegatedIntegrationInstanceProviderId: provider.id
      }))
    );

    let lastProvider = providers[providers.length - 1];
    if (!lastProvider) return;

    await delegatedIntegrationInstanceArchiveProvidersManyQueue.add({
      delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId,
      cursor: lastProvider.id
    });
  });

export let delegatedIntegrationInstanceCreatedQueue = createQueue<{
  delegatedIntegrationInstanceId: string;
}>({
  name: 'sub/int/lc/delegatedIntegrationInstance/created',
  redisUrl: env.service.REDIS_URL
});

export let delegatedIntegrationInstanceCreatedQueueProcessor =
  delegatedIntegrationInstanceCreatedQueue.process(async data => {
    await syncDelegatedIntegrationInstanceSessionTemplatesQueue.add({
      delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId
    });
  });

export let delegatedIntegrationInstanceUpdatedQueue = createQueue<{
  delegatedIntegrationInstanceId: string;
}>({
  name: 'sub/int/lc/delegatedIntegrationInstance/updated',
  redisUrl: env.service.REDIS_URL
});

export let delegatedIntegrationInstanceUpdatedQueueProcessor =
  delegatedIntegrationInstanceUpdatedQueue.process(async data => {
    await syncDelegatedIntegrationInstanceSessionTemplatesQueue.add({
      delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId
    });
  });

export let delegatedIntegrationInstanceArchivedQueue = createQueue<{
  delegatedIntegrationInstanceId: string;
}>({
  name: 'sub/int/lc/delegatedIntegrationInstance/archived',
  redisUrl: env.service.REDIS_URL
});

export let delegatedIntegrationInstanceArchivedQueueProcessor =
  delegatedIntegrationInstanceArchivedQueue.process(async data => {
    let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.findUnique({
      where: { id: data.delegatedIntegrationInstanceId }
    });
    if (!delegatedIntegrationInstance || delegatedIntegrationInstance.status !== 'archived') {
      return;
    }

    await runDelegatedIntegrationInstanceArchivedEffects({
      delegatedIntegrationInstanceId: data.delegatedIntegrationInstanceId,
      delegatedIntegrationInstanceOid: delegatedIntegrationInstance.oid,
      archivedAt: delegatedIntegrationInstance.archivedAt ?? new Date()
    });
  });
