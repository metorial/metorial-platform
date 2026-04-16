import { createCron } from '@lowerdeck/cron';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerAuthConfigInternalService } from '../../services/providerAuthConfigInternal';
import { providerAuthCredentialsService } from '../../services/providerAuthCredentials';

let RECONCILE_BATCH_SIZE = 100;

export let reconcileProviderAuthConfigScopesQueue = createQueue<{
  id: string;
}>({
  name: 'sub/auth/scopes/reconcile/config',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileProviderAuthConfigScopesQueueProcessor =
  reconcileProviderAuthConfigScopesQueue.process(async data => {
    let providerAuthConfig = await db.providerAuthConfig.findFirst({
      where: {
        id: data.id,
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

export let reconcileProviderAuthConfigScopesCron = createCron(
  {
    name: 'sub/auth/cron/reconcileConfigScopes',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let providerAuthConfigs = await db.providerAuthConfig.findMany({
      where: {
        needsScopeSync: true,
        status: {
          not: 'deleted'
        }
      },
      orderBy: { updatedAt: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: { id: true }
    });

    if (!providerAuthConfigs.length) {
      return;
    }

    await reconcileProviderAuthConfigScopesQueue.addManyWithOps(
      providerAuthConfigs.map(item => ({
        data: {
          id: item.id
        },
        opts: {
          id: `auth_config:${item.id}`
        }
      }))
    );
  }
);

export let reconcileProviderAuthCredentialsScopesQueue = createQueue<{
  id: string;
}>({
  name: 'sub/auth/scopes/reconcile/credentials',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileProviderAuthCredentialsScopesQueueProcessor =
  reconcileProviderAuthCredentialsScopesQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findFirst({
      where: {
        id: data.id,
        status: {
          not: 'deleted'
        }
      },
      include: {
        tenant: true
      }
    });
    if (!providerAuthCredentials) throw new QueueRetryError();

    await providerAuthCredentialsService.syncProviderAuthCredentialsScopes({
      tenant: providerAuthCredentials.tenant,
      providerAuthCredentials
    });
  });

export let reconcileProviderAuthCredentialsScopesCron = createCron(
  {
    name: 'sub/auth/cron/reconcileCredentialScopes',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let providerAuthCredentials = await db.providerAuthCredentials.findMany({
      where: {
        needsScopeSync: true,
        status: {
          not: 'deleted'
        }
      },
      orderBy: { updatedAt: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: { id: true }
    });

    if (!providerAuthCredentials.length) {
      return;
    }

    await reconcileProviderAuthCredentialsScopesQueue.addManyWithOps(
      providerAuthCredentials.map(item => ({
        data: {
          id: item.id
        },
        opts: {
          id: `auth_credentials:${item.id}`
        }
      }))
    );
  }
);
