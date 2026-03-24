import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

let startRankQueue = createQueue<{ cursor?: string }>({
  name: 'sub/pint/rank/start',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let processSingleRankQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/rank/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 2,
    limiter: process.env.NODE_ENV === 'development' ? undefined : { max: 20, duration: 1000 }
  }
});

let rankCron = createCron(
  {
    name: 'sub/pint/rank/cron',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (process.env.NODE_ENV === 'development') return;
    await startRankQueue.add({}, { id: 'rank' });
  }
);

let startRankQueueProcessor = startRankQueue.process(async data => {
  let providers = await db.providerListing.findMany({
    where: {
      isPublic: true,
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    select: { id: true },
    take: 100,
    orderBy: { id: 'asc' }
  });
  if (providers.length === 0) return;

  await processSingleRankQueue.addManyWithOps(
    providers.map(provider => ({
      data: { providerListingId: provider.id },
      opts: { id: provider.id }
    }))
  );

  await startRankQueue.add({ cursor: providers[providers.length - 1].id });
});

let processSingleRankQueueProcessor = processSingleRankQueue.process(async data => {
  let providerListing = await db.providerListing.findUnique({
    where: { id: data.providerListingId, isPublic: true },
    include: {
      publisher: true,
      provider: {
        include: {
          defaultVariant: {
            include: {
              backend: true
            }
          }
        }
      }
    }
  });
  if (!providerListing) return;

  let rank = 0;
  let deploymentsCount = 0;
  let providerSessionsCount = 0;
  let providerMessagesCount = 0;

  let isVerified = providerListing.isVerified;
  let isMetorial = providerListing.isMetorial;
  let isSlates =
    providerListing.provider.access == 'public' &&
    !!providerListing.provider.defaultVariant?.slateOid;
  let isNative = providerListing.provider.defaultVariant?.backend.type === 'native';

  let isOfficial = providerListing.isOfficial;

  deploymentsCount = await db.providerDeployment.count({
    where: { providerOid: providerListing.providerOid }
  });
  providerSessionsCount = await db.sessionProvider.count({
    where: { providerOid: providerListing.providerOid }
  });

  let providerMessagesCountAgg = await db.sessionProvider.aggregate({
    where: { providerOid: providerListing.providerOid },
    _sum: {
      totalProductiveProviderMessageCount: true,
      totalProductiveClientMessageCount: true
    }
  });

  providerMessagesCount =
    (providerMessagesCountAgg._sum.totalProductiveProviderMessageCount ?? 0) +
    (providerMessagesCountAgg._sum.totalProductiveClientMessageCount ?? 0);

  // Calculate rank based on various factors
  rank = Math.ceil(
    deploymentsCount * 0.1 + providerSessionsCount * 0.3 + providerMessagesCount * 0.01
  );

  // Boost rank for official/metorial providers
  if (isMetorial) {
    if (isSlates) rank += 10_000;
    if (isNative) rank += 20_000;
    rank = 10_000 + Math.ceil(rank * 5);
  } else if (isOfficial || isVerified) rank = Math.ceil(rank * 3);

  rank = Math.min(rank, 1_000_000_000);

  await db.providerListing.updateMany({
    where: { oid: providerListing.oid },
    data: {
      deploymentsCount,
      providerSessionsCount,
      providerMessagesCount,

      rank,
      rankUpdatedAt: new Date()
    }
  });
});

export let rankProcessors = combineQueueProcessors([
  rankCron,
  startRankQueueProcessor,
  processSingleRankQueueProcessor
]);
