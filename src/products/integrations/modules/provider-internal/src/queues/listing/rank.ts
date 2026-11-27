import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';

let RANK_BATCH_SIZE = 500;
import { db, withReplicaReads } from '@metorial-subspace/db';
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
    cron: '0 */4 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (process.env.NODE_ENV === 'development') return;
    await startRankQueue.add({}, { id: 'rank' });
  }
);

let startRankQueueProcessor = startRankQueue.process(async data => {
  let providers = await withReplicaReads(() =>
    db.providerListing.findMany({
      where: {
        isPublic: true,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: { id: true },
      take: RANK_BATCH_SIZE,
      orderBy: { id: 'asc' }
    })
  );
  if (providers.length === 0) return;

  await processSingleRankQueue.addManyWithOps(
    providers.map(provider => ({
      data: { providerListingId: provider.id },
      opts: { id: provider.id }
    }))
  );

  if (providers.length === RANK_BATCH_SIZE) {
    await startRankQueue.add(
      { cursor: providers[providers.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
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

  let isVerified = providerListing.isVerified;
  let isMetorial = providerListing.isMetorial;
  let isSlates =
    providerListing.provider.access == 'public' &&
    !!providerListing.provider.defaultVariant?.slateOid;
  let isNative = providerListing.provider.defaultVariant?.backend.type === 'native';

  let isOfficial = providerListing.isOfficial;

  let providerOid = providerListing.providerOid;
  let {
    deploymentsCount,
    providerSessionsCount,
    providerMessagesCount,
    hasManagedCredentials
  } = await withReplicaReads(async () => {
    let messages = await db.sessionProvider.aggregate({
      where: { providerOid },
      _sum: {
        totalProductiveProviderMessageCount: true,
        totalProductiveClientMessageCount: true
      }
    });

    return {
      deploymentsCount: await db.providerDeployment.count({ where: { providerOid } }),
      providerSessionsCount: await db.sessionProvider.count({ where: { providerOid } }),
      providerMessagesCount:
        (messages._sum.totalProductiveProviderMessageCount ?? 0) +
        (messages._sum.totalProductiveClientMessageCount ?? 0),
      hasManagedCredentials: !!(await db.managedProviderAuthCredentials.findFirst({
        where: { providerOid },
        select: { oid: true }
      }))
    };
  });

  // Calculate rank based on various factors
  let rank = Math.ceil(
    deploymentsCount * 0.1 + providerSessionsCount * 0.3 + providerMessagesCount * 0.01
  );

  // Boost rank for official/metorial providers
  if (isMetorial) {
    if (isSlates) rank += 10_000;
    if (isNative) rank += 20_000;
    rank = 10_000 + Math.ceil(rank * 5);
  } else if (isOfficial || isVerified) rank = Math.ceil(rank * 3);

  if (hasManagedCredentials) rank += 50_000;

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
