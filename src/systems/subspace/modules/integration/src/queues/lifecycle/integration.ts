import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { identityInternalService } from '@metorial-subspace/module-identity';
import { env } from '../../env';
import {
  createIntegrationProviderVersion,
  createIntegrationVersion
} from '../../lib/versions';
import { indexIntegrationQueue } from '../search/integration';
import { indexIntegrationInstanceQueue } from '../search/integrationInstance';
import { archiveIntegrationInstanceQueue } from './archiveIntegrationInstance';
import { integrationProviderArchivedQueue } from './integrationProvider';

export let integrationCreatedQueue = createQueue<{ integrationId: string }>({
  name: 'sub/int/lc/integration/created',
  redisUrl: env.service.REDIS_URL
});

export let integrationCreatedQueueProcessor = integrationCreatedQueue.process(async data => {
  await indexIntegrationQueue.add({ integrationId: data.integrationId });
});

export let integrationUpdatedQueue = createQueue<{ integrationId: string }>({
  name: 'sub/int/lc/integration/updated',
  redisUrl: env.service.REDIS_URL
});

export let integrationUpdatedQueueProcessor = integrationUpdatedQueue.process(async data => {
  await indexIntegrationQueue.add({ integrationId: data.integrationId });
});

export let integrationArchivedQueue = createQueue<{ integrationId: string }>({
  name: 'sub/int/lc/integration/archived',
  redisUrl: env.service.REDIS_URL
});

export let integrationArchivedQueueProcessor = integrationArchivedQueue.process(async data => {
  let integration = await db.integration.findUnique({
    where: { id: data.integrationId }
  });
  if (!integration || integration.status !== 'archived') return;

  await indexIntegrationQueue.add({ integrationId: data.integrationId });
  await integrationArchiveInstancesManyQueue.add({ integrationId: data.integrationId });
  await integrationArchiveProvidersManyQueue.add({ integrationId: data.integrationId });
});

export let integrationArchiveInstancesManyQueue = createQueue<{
  integrationId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integration/archiveInstancesMany',
  redisUrl: env.service.REDIS_URL
});

export let integrationArchiveInstancesManyQueueProcessor =
  integrationArchiveInstancesManyQueue.process(async data => {
    let integration = await db.integration.findUnique({
      where: { id: data.integrationId }
    });
    if (!integration || integration.status !== 'archived') return;

    let integrationInstances = await db.integrationInstance.findMany({
      where: {
        integrationOid: integration.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { oid: true, id: true }
    });
    if (integrationInstances.length === 0) return;

    await db.integrationInstance.updateMany({
      where: {
        oid: { in: integrationInstances.map(integrationInstance => integrationInstance.oid) }
      },
      data: { isParentDeleted: true }
    });

    await archiveIntegrationInstanceQueue.addMany(
      integrationInstances.map(integrationInstance => ({
        integrationInstanceId: integrationInstance.id
      }))
    );
    await indexIntegrationInstanceQueue.addMany(
      integrationInstances.map(integrationInstance => ({
        integrationInstanceId: integrationInstance.id
      }))
    );
    let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
      where: {
        integrationInstanceOid: {
          in: integrationInstances.map(integrationInstance => integrationInstance.oid)
        },
        status: {
          not: 'deleted'
        }
      },
      select: {
        id: true
      }
    });
    await identityInternalService.syncIntegrationInstanceProviderCredentials({
      integrationInstanceProviderIds: integrationInstanceProviders.map(
        integrationInstanceProvider => integrationInstanceProvider.id
      )
    });

    let lastIntegrationInstance = integrationInstances[integrationInstances.length - 1];
    if (!lastIntegrationInstance) return;

    await integrationArchiveInstancesManyQueue.add({
      integrationId: data.integrationId,
      cursor: lastIntegrationInstance.id
    });
  });

export let integrationArchiveProvidersManyQueue = createQueue<{
  integrationId: string;
  cursor?: string;
}>({
  name: 'sub/int/lc/integration/archiveProvidersMany',
  redisUrl: env.service.REDIS_URL
});

export let integrationArchiveProvidersManyQueueProcessor =
  integrationArchiveProvidersManyQueue.process(async data => {
    let integration = await db.integration.findUnique({
      where: { id: data.integrationId }
    });
    if (!integration || integration.status !== 'archived') return;

    let integrationProviders = await db.integrationProvider.findMany({
      where: {
        integrationOid: integration.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 1000,
      include: { currentVersion: true }
    });
    if (integrationProviders.length === 0) return;

    let archivedAt = integration.archivedAt ?? new Date();

    for (let integrationProvider of integrationProviders) {
      if (integrationProvider.currentVersion) {
        await createIntegrationProviderVersion({
          integrationProviderOid: integrationProvider.oid,
          status: 'archived',
          deploymentOid: integrationProvider.currentVersion.deploymentOid,
          authMethodOid: integrationProvider.currentVersion.authMethodOid,
          authCredentialsOid: integrationProvider.currentVersion.authCredentialsOid,
          configOid: integrationProvider.currentVersion.configOid,
          toolFilter: integrationProvider.currentVersion.toolFilter as PrismaJson.ToolFilter
        });

        await db.integrationProvider.updateMany({
          where: { oid: integrationProvider.oid },
          data: { status: 'archived', archivedAt }
        });
      } else {
        await db.integrationProvider.updateMany({
          where: { oid: integrationProvider.oid },
          data: { status: 'archived', archivedAt }
        });
      }
    }

    await createIntegrationVersion({ integrationOid: integration.oid });

    await integrationProviderArchivedQueue.addMany(
      integrationProviders.map(integrationProvider => ({
        integrationProviderId: integrationProvider.id
      }))
    );

    let lastIntegrationProvider = integrationProviders[integrationProviders.length - 1];
    if (!lastIntegrationProvider) return;

    await integrationArchiveProvidersManyQueue.add({
      integrationId: data.integrationId,
      cursor: lastIntegrationProvider.id
    });
  });

export let integrationDeletedQueue = createQueue<{ integrationId: string }>({
  name: 'sub/int/lc/integration/deleted',
  redisUrl: env.service.REDIS_URL
});

export let integrationDeletedQueueProcessor = integrationDeletedQueue.process(async data => {
  await indexIntegrationQueue.add({ integrationId: data.integrationId });
});
