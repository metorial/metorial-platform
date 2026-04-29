import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import {
  createIntegrationProviderVersion,
  createIntegrationVersion
} from '../../lib/versions';
import { indexIntegrationQueue } from '../search/integration';
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
  await indexIntegrationQueue.add({ integrationId: data.integrationId });
  await integrationArchiveProvidersManyQueue.add({ integrationId: data.integrationId });
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
          data: {
            status: 'archived',
            archivedAt
          }
        });
      } else {
        await db.integrationProvider.updateMany({
          where: { oid: integrationProvider.oid },
          data: {
            status: 'archived',
            archivedAt
          }
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
