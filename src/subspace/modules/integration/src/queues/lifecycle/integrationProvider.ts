import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { identityInternalService } from '@metorial-subspace/module-identity';
import { enqueueSyncIntegrationInstanceGroupSessionTemplatesMany } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { enqueueSyncIntegrationInstanceSessionTemplatesMany } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate';
import { reconcileSkillProviderLinksForIntegrationProviderQueue } from '@metorial-subspace/module-skills/src/queues/reconciler/reconcileSkillProviderLink';
import { env } from '../../env';
import { integrationInstanceProviderService } from '../../services/integrationInstanceProvider';
import { indexIntegrationQueue } from '../search/integration';
import { indexIntegrationInstanceQueue } from '../search/integrationInstance';
import { enqueueIntegrationInstanceProvidersSet } from './integrationInstanceProvider';

let syncIntegrationInstanceSessionTemplates = async (integrationInstanceIds: string[]) => {
  if (integrationInstanceIds.length === 0) return;

  await enqueueSyncIntegrationInstanceSessionTemplatesMany(
    integrationInstanceIds.map(integrationInstanceId => ({ integrationInstanceId }))
  );
};

let syncIntegrationInstanceGroupSessionTemplates = async (
  integrationInstanceGroupIds: string[]
) => {
  if (integrationInstanceGroupIds.length === 0) return;

  await enqueueSyncIntegrationInstanceGroupSessionTemplatesMany(
    integrationInstanceGroupIds.map(integrationInstanceGroupId => ({
      integrationInstanceGroupId
    }))
  );
};

export let integrationProviderCreatedQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/int/lc/integrationProvider/created',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderCreatedQueueProcessor = integrationProviderCreatedQueue.process(
  async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      include: { integration: true }
    });
    if (!integrationProvider) throw new QueueRetryError();

    await indexIntegrationQueue.add({ integrationId: integrationProvider.integration.id });
    await reconcileSkillProviderLinksForIntegrationProviderQueue.add({
      integrationProviderId: data.integrationProviderId
    });

    await db.integrationInstanceProvider.updateMany({
      where: { integrationProviderOid: integrationProvider.oid },
      data: { isParentDeleted: false }
    });
  }
);

export let integrationProviderUpdatedQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/int/lc/integrationProvider/updated',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderUpdatedQueueProcessor = integrationProviderUpdatedQueue.process(
  async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      include: { integration: true }
    });
    if (!integrationProvider) return;

    await indexIntegrationQueue.add({ integrationId: integrationProvider.integration.id });
    await reconcileSkillProviderLinksForIntegrationProviderQueue.add({
      integrationProviderId: data.integrationProviderId
    });

    await integrationProviderUpdatedSyncIntegrationInstanceSessionsQueue.add({
      integrationProviderId: data.integrationProviderId
    });
    await integrationProviderUpdatedSyncIntegrationInstanceGroupSessionsQueue.add({
      integrationProviderId: data.integrationProviderId
    });
  }
);

export let integrationProviderUpdatedSyncIntegrationInstanceSessionsQueue = createQueue<{
  integrationProviderId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationProvider/updated/instance',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderUpdatedSyncIntegrationInstanceSessionsQueueProcessor =
  integrationProviderUpdatedSyncIntegrationInstanceSessionsQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      select: { oid: true, currentVersionOid: true }
    });
    if (!integrationProvider) return;

    let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
      where: {
        integrationProviderOid: integrationProvider.oid,
        status: 'active',
        isParentDeleted: false,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        integrationInstance: { select: { id: true } },
        oid: true,
        currentVersion: {
          select: {
            integrationProviderVersionOid: true,
            configOid: true,
            authConfigOid: true,
            toolFilter: true,
            isOverrideToolFilter: true
          }
        },
        id: true
      }
    });
    if (!integrationInstanceProviders.length) return;

    await integrationInstanceProviderService.repinIntegrationInstanceProvidersToIntegrationProviderVersion(
      {
        integrationProviderVersionOid: integrationProvider.currentVersionOid,
        integrationInstanceProviders
      }
    );

    await syncIntegrationInstanceSessionTemplates(
      Array.from(
        new Set(integrationInstanceProviders.map(provider => provider.integrationInstance.id))
      )
    );

    let lastIntegrationInstanceProvider =
      integrationInstanceProviders[integrationInstanceProviders.length - 1];
    if (!lastIntegrationInstanceProvider) return;

    await integrationProviderUpdatedSyncIntegrationInstanceSessionsQueue.add({
      integrationProviderId: data.integrationProviderId,
      cursor: lastIntegrationInstanceProvider.id
    });
  });

export let integrationProviderUpdatedSyncIntegrationInstanceGroupSessionsQueue = createQueue<{
  integrationProviderId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationProvider/updated/group',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderUpdatedSyncIntegrationInstanceGroupSessionsQueueProcessor =
  integrationProviderUpdatedSyncIntegrationInstanceGroupSessionsQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      select: { oid: true, currentVersionOid: true }
    });
    if (!integrationProvider) return;

    let integrationInstanceGroupProviders = await db.integrationInstanceGroupProvider.findMany(
      {
        where: {
          integrationProviderOid: integrationProvider.oid,
          status: 'active',
          isParentDeleted: false,
          id: data.cursor ? { gt: data.cursor } : undefined
        },
        orderBy: { id: 'asc' },
        take: 100,
        select: {
          integrationInstanceGroup: { select: { id: true } },
          integrationInstanceProvider: {
            select: {
              oid: true,
              currentVersion: {
                select: {
                  integrationProviderVersionOid: true,
                  configOid: true,
                  authConfigOid: true,
                  toolFilter: true,
                  isOverrideToolFilter: true
                }
              }
            }
          },
          id: true
        }
      }
    );
    if (!integrationInstanceGroupProviders.length) return;

    await integrationInstanceProviderService.repinIntegrationInstanceProvidersToIntegrationProviderVersion(
      {
        integrationProviderVersionOid: integrationProvider.currentVersionOid,
        integrationInstanceProviders: integrationInstanceGroupProviders.map(
          provider => provider.integrationInstanceProvider
        )
      }
    );

    await syncIntegrationInstanceGroupSessionTemplates(
      Array.from(
        new Set(
          integrationInstanceGroupProviders.map(
            provider => provider.integrationInstanceGroup.id
          )
        )
      )
    );

    let lastProvider =
      integrationInstanceGroupProviders[integrationInstanceGroupProviders.length - 1];
    if (!lastProvider) return;

    await integrationProviderUpdatedSyncIntegrationInstanceGroupSessionsQueue.add({
      integrationProviderId: data.integrationProviderId,
      cursor: lastProvider.id
    });
  });

export let integrationProviderArchivedQueue = createQueue<{ integrationProviderId: string }>({
  name: 'sub/int/lc/integrationProvider/archived',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderArchivedQueueProcessor =
  integrationProviderArchivedQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      include: { integration: true }
    });
    if (!integrationProvider || integrationProvider.status !== 'archived') return;

    await integrationProviderArchiveInstanceProvidersManyQueue.add({
      integrationProviderId: data.integrationProviderId
    });
    await integrationProviderArchiveGroupProvidersManyQueue.add({
      integrationProviderId: data.integrationProviderId
    });
    await indexIntegrationQueue.add({ integrationId: integrationProvider.integration.id });
    await reconcileSkillProviderLinksForIntegrationProviderQueue.add({
      integrationProviderId: data.integrationProviderId
    });
  });

export let integrationProviderArchiveInstanceProvidersManyQueue = createQueue<{
  integrationProviderId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationProvider/archiveInstanceProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderArchiveInstanceProvidersManyQueueProcessor =
  integrationProviderArchiveInstanceProvidersManyQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId }
    });
    if (!integrationProvider || integrationProvider.status !== 'archived') return;

    let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
      where: {
        integrationProviderOid: integrationProvider.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: {
        oid: true,
        id: true,
        integrationInstance: { select: { id: true } }
      }
    });
    if (integrationInstanceProviders.length === 0) return;

    let archivedAt = integrationProvider.archivedAt ?? new Date();

    await db.integrationInstanceProvider.updateMany({
      where: {
        oid: {
          in: integrationInstanceProviders.map(
            integrationInstanceProvider => integrationInstanceProvider.oid
          )
        },
        status: 'active'
      },
      data: {
        status: 'archived',
        archivedAt,
        isParentDeleted: true
      }
    });

    await enqueueIntegrationInstanceProvidersSet(
      integrationInstanceProviders.map(provider => ({
        integrationInstanceId: provider.integrationInstance.id,
        integrationInstanceProviderId: provider.id
      }))
    );

    await indexIntegrationInstanceQueue.addMany(
      integrationInstanceProviders.map(provider => ({
        integrationInstanceId: provider.integrationInstance.id
      }))
    );
    await syncIntegrationInstanceSessionTemplates(
      integrationInstanceProviders.map(provider => provider.integrationInstance.id)
    );
    await identityInternalService.syncIntegrationInstanceProviderCredentials({
      integrationInstanceProviderIds: integrationInstanceProviders.map(provider => provider.id)
    });

    let lastIntegrationInstanceProvider =
      integrationInstanceProviders[integrationInstanceProviders.length - 1];
    if (!lastIntegrationInstanceProvider) return;

    await integrationProviderArchiveInstanceProvidersManyQueue.add({
      integrationProviderId: data.integrationProviderId,
      cursor: lastIntegrationInstanceProvider.id
    });
  });

export let integrationProviderArchiveGroupProvidersManyQueue = createQueue<{
  integrationProviderId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integrationProvider/archiveGroupProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let integrationProviderArchiveGroupProvidersManyQueueProcessor =
  integrationProviderArchiveGroupProvidersManyQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId }
    });
    if (!integrationProvider || integrationProvider.status !== 'archived') return;

    let groupProviders = await db.integrationInstanceGroupProvider.findMany({
      where: {
        integrationProviderOid: integrationProvider.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      include: { integrationInstanceGroup: true }
    });
    if (groupProviders.length === 0) return;

    await db.integrationInstanceGroupProvider.updateMany({
      where: { oid: { in: groupProviders.map(provider => provider.oid) } },
      data: { isParentDeleted: true }
    });

    await enqueueSyncIntegrationInstanceGroupSessionTemplatesMany(
      Array.from(
        new Set(groupProviders.map(provider => provider.integrationInstanceGroup.id))
      ).map(integrationInstanceGroupId => ({ integrationInstanceGroupId }))
    );

    let lastProvider = groupProviders[groupProviders.length - 1];
    if (!lastProvider) return;

    await integrationProviderArchiveGroupProvidersManyQueue.add({
      integrationProviderId: data.integrationProviderId,
      cursor: lastProvider.id
    });
  });
