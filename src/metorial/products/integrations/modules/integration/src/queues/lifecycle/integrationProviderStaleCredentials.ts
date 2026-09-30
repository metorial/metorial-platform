import { createCron } from '@lowerdeck/cron';
import { isServiceError } from '@lowerdeck/error';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { integrationProviderService } from '../../services/integrationProvider';

let STALE_CREDENTIALS_BATCH_SIZE = 500;

export let integrationProviderStaleCredentialsCron = createCron(
  {
    name: 'sub/int/cron/integrationProviderStaleCredentials',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await integrationProviderStaleCredentialsManyQueue.add(
      {},
      { id: 'stale-credentials-many' }
    );
  }
);

let integrationProviderStaleCredentialsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/lc/integrationProvider/staleCredentials/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let integrationProviderStaleCredentialsManyQueueProcessor =
  integrationProviderStaleCredentialsManyQueue.process(async data => {
    let integrationProviders = await db.integrationProvider.findMany({
      where: {
        status: 'active',
        integration: { status: 'active' },
        currentVersion: {
          authCredentials: { status: { in: ['archived', 'deleted'] } }
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: STALE_CREDENTIALS_BATCH_SIZE,
      select: { id: true }
    });
    if (!integrationProviders.length) return;

    await integrationProviderStaleCredentialsSingleQueue.addManyWithOps(
      integrationProviders.map(integrationProvider => ({
        data: { integrationProviderId: integrationProvider.id },
        opts: { id: `stale-credentials-${integrationProvider.id}` }
      }))
    );

    if (integrationProviders.length === STALE_CREDENTIALS_BATCH_SIZE) {
      await integrationProviderStaleCredentialsManyQueue.add(
        { cursor: integrationProviders[integrationProviders.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });

let integrationProviderStaleCredentialsSingleQueue = createQueue<{
  integrationProviderId: string;
}>({
  name: 'sub/int/lc/integrationProvider/staleCredentials/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let integrationProviderStaleCredentialsSingleQueueProcessor =
  integrationProviderStaleCredentialsSingleQueue.process(async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      include: { tenant: true, environment: true }
    });
    if (!integrationProvider || integrationProvider.status !== 'active') return;

    try {
      await integrationProviderService.resolveUsableIntegrationProviderMaterialInternal({
        tenant: integrationProvider.tenant,
        environment: integrationProvider.environment,
        integrationProvider
      });
    } catch (error) {
      if (
        isServiceError(error) &&
        error.data.code === 'integration_provider_credentials_unavailable'
      ) {
        return;
      }

      throw error;
    }
  });

export let integrationProviderStaleCredentialsProcessors = combineQueueProcessors([
  integrationProviderStaleCredentialsCron,
  integrationProviderStaleCredentialsManyQueueProcessor,
  integrationProviderStaleCredentialsSingleQueueProcessor
]);
