import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderAuthMethodsQueue } from './providerAuthMethod';
import { indexProviderToolsQueue } from './providerTool';

let RECONCILE_SEARCH_BATCH_SIZE = 500;

// Temporary: backfills the provider tool and auth method indexes and covers writes that bypass
// the indexing hooks. Remove once the hooks have proven reliable.
let reconcileSearchStartQueue = createQueue<{ cursor?: string }>({
  name: 'sub/sidx/reconcile/start',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let reconcileSearchCron = createCron(
  {
    name: 'sub/sidx/reconcile/cron',
    cron: '0 3 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await reconcileSearchStartQueue.add({}, { id: 'reconcile' });
  }
);

let reconcileSearchStartQueueProcessor = reconcileSearchStartQueue.process(async data => {
  let providers = await db.provider.findMany({
    where: { id: data.cursor ? { gt: data.cursor } : undefined },
    select: { id: true },
    take: RECONCILE_SEARCH_BATCH_SIZE,
    orderBy: { id: 'asc' }
  });
  if (!providers.length) return;

  await indexProviderToolsQueue.addManyWithOps(
    providers.map(provider => ({
      data: { providerId: provider.id },
      opts: { id: provider.id }
    }))
  );
  await indexProviderAuthMethodsQueue.addManyWithOps(
    providers.map(provider => ({
      data: { providerId: provider.id },
      opts: { id: provider.id }
    }))
  );

  if (providers.length === RECONCILE_SEARCH_BATCH_SIZE) {
    await reconcileSearchStartQueue.add(
      { cursor: providers[providers.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

export let reconcileSearchProcessors = combineQueueProcessors([
  reconcileSearchCron,
  reconcileSearchStartQueueProcessor
]);
