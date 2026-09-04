import { createCron } from '@lowerdeck/cron';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { providerInternalService } from '../../services/provider';

export let deprecateDockerProviderReconcilerCron = createCron(
  {
    name: 'sub/pint/reconcile/provider/deprecate/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    await deprecateDockerProviderManyQueue.add({});
  }
);

let deprecateDockerProviderManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/pint/reconcile/provider/deprecate/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let deprecateDockerProviderManyQueueProcessor =
  deprecateDockerProviderManyQueue.process(async data => {
    let providers = await db.provider.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        ownerTenantOid: null,
        isDeprecated: false,
        type: {
          OR: [{ attributes: { path: ['backend'], equals: 'mcp.container' } }]
        }
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providers.length === 0) return;

    await deprecateDockerProviderSingleQueue.addMany(
      providers.map(provider => ({
        providerId: provider.id
      }))
    );

    await deprecateDockerProviderManyQueue.add({
      cursor: providers[providers.length - 1]!.id
    });
  });

let deprecateDockerProviderSingleQueue = createQueue<{ providerId: string }>({
  name: 'sub/pint/reconcile/provider/deprecate/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 25,
      duration: 1000
    }
  }
});

export let deprecateDockerProviderSingleQueueProcessor =
  deprecateDockerProviderSingleQueue.process(async data => {
    let provider = await db.provider.findFirst({
      where: { id: data.providerId },
      include: { type: true }
    });
    if (!provider) throw new QueueRetryError();
    if (provider.isDeprecated || provider.ownerTenantOid !== null) return;

    let backend = provider.type.attributes.backend;
    if (backend !== 'mcp.container') return;

    await providerInternalService.deprecateProvider({ provider });
  });
