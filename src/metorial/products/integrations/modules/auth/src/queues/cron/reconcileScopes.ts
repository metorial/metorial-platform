import { createCron } from '@lowerdeck/cron';
import { createQueue, hourlyPacedDelay, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerAuthConfigInternalService } from '../../services/providerAuthConfigInternal';
import { providerAuthCredentialsService } from '../../services/providerAuthCredentials';

let RECONCILE_BATCH_SIZE = 500;

export let reconcileProviderAuthCredentialsScopesCron = createCron(
  {
    name: 'sub/auth/cron/reconcileCredentialScopes',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await reconcileProviderAuthCredentialsScopesManyQueue.add(
      {},
      { id: `auth_credentials-many` }
    );
  }
);

export let reconcileProviderAuthConfigScopesCron = createCron(
  {
    name: 'sub/auth/cron/reconcileConfigScopes',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await reconcileProviderAuthConfigScopesManyQueue.add({}, { id: `auth_config-many` });
  }
);

let reconcileProviderAuthConfigScopesManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/auth/scopes/reconcile/config/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileProviderAuthConfigScopesManyQueueProcessor =
  reconcileProviderAuthConfigScopesManyQueue.process(async data => {
    let providerAuthConfigs = await db.providerAuthConfig.findMany({
      where: {
        needsScopeSync: true,
        status: { not: 'deleted' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!providerAuthConfigs.length) return;

    await reconcileProviderAuthConfigScopesQueue.addManyWithOps(
      providerAuthConfigs.map(item => ({
        data: {
          authConfigId: item.id
        },
        opts: {
          id: `auth_config-${item.id}`
        }
      }))
    );

    if (providerAuthConfigs.length === RECONCILE_BATCH_SIZE) {
      await reconcileProviderAuthConfigScopesManyQueue.add(
        { cursor: providerAuthConfigs[providerAuthConfigs.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });

let reconcileProviderAuthCredentialsScopesManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/auth/scopes/reconcile/credentials/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileProviderAuthCredentialsScopesManyQueueProcessor =
  reconcileProviderAuthCredentialsScopesManyQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findMany({
      where: {
        needsScopeSync: true,
        status: { not: 'deleted' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!providerAuthCredentials.length) return;

    await reconcileProviderAuthCredentialsScopesQueue.addManyWithOps(
      providerAuthCredentials.map(item => ({
        data: {
          authCredentialsId: item.id
        },
        opts: {
          id: `auth_credentials-${item.id}`
        }
      }))
    );

    if (providerAuthCredentials.length === RECONCILE_BATCH_SIZE) {
      await reconcileProviderAuthCredentialsScopesManyQueue.add(
        { cursor: providerAuthCredentials[providerAuthCredentials.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });

let reconcileProviderAuthConfigScopesQueue = createQueue<{
  authConfigId: string;
}>({
  name: 'sub/auth/scopes/reconcile/config',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

export let reconcileProviderAuthConfigScopesQueueProcessor =
  reconcileProviderAuthConfigScopesQueue.process(async data => {
    let providerAuthConfig = await db.providerAuthConfig.findFirst({
      where: {
        id: data.authConfigId,
        status: {
          not: 'deleted'
        }
      },
      include: {
        currentVersion: true,
        tenant: true
      }
    });
    if (!providerAuthConfig) throw new QueueRetryError();

    await providerAuthConfigInternalService.syncProviderAuthConfigScopes({
      tenant: providerAuthConfig.tenant,
      providerAuthConfig
    });
  });

let reconcileProviderAuthCredentialsScopesQueue = createQueue<{
  authCredentialsId: string;
}>({
  name: 'sub/auth/scopes/reconcile/credentials',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

export let reconcileProviderAuthCredentialsScopesQueueProcessor =
  reconcileProviderAuthCredentialsScopesQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findFirst({
      where: {
        id: data.authCredentialsId,
        status: {
          not: 'deleted'
        }
      },
      include: {
        tenant: true
      }
    });
    if (!providerAuthCredentials) throw new QueueRetryError();
    if (!providerAuthCredentials.tenant) return;

    await providerAuthCredentialsService.syncProviderAuthCredentialsScopesInternal({
      tenant: providerAuthCredentials.tenant,
      providerAuthCredentials
    });
  });
