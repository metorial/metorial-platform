import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { debug } from '@metorial/debug';
import { combineQueueProcessors, createQueue } from '@metorial/queue';

let rankCron = createCron(
  {
    name: 'cat/rank/cron',
    cron: '0 * * * *'
  },
  async () => {
    // await startRankQueue.add({});
  }
);

let startRankQueue = createQueue({
  name: 'cat/rank/start',
  workerOpts: {
    concurrency: 1
  }
});

let processSingleRankQueue = createQueue<{ serverListingId: string }>({
  name: 'cat/rank/single',
  workerOpts: {
    concurrency: 1,

    limiter:
      process.env.NODE_ENV == 'development'
        ? undefined
        : {
            max: 20,
            duration: 1000
          }
  }
});

export let startRankQueueProcessor = startRankQueue.process(async () => {
  let afterId: string | undefined = undefined;

  while (true) {
    let servers = await db.serverListing.findMany({
      where: {
        id: { gt: afterId }
      },
      select: { id: true },
      take: 100,
      orderBy: { id: 'asc' }
    });
    if (servers.length == 0) break;

    await processSingleRankQueue.addManyWithOps(
      servers.map(server => ({
        data: { serverListingId: server.id },
        opts: { id: server.id }
      }))
    );

    afterId = servers[servers.length - 1].id as string;
  }
});

export let processSingleRankQueueProcessor = processSingleRankQueue.process(async data => {
  let serverListing = await db.serverListing.findUnique({
    where: { id: data.serverListingId },
    include: {
      server: {
        include: {
          importedServer: {
            include: {
              repository: true
            }
          }
        }
      }
    }
  });
  if (!serverListing) return;

  debug.log('Processing rank for serverListingId', serverListing.slug);

  let rank = 0;
  let deploymentsCount = 0;
  let serverSessionsCount = 0;
  let serverMessagesCount = 0;
  let repoStarsCount = 0;

  // Only calculate rank for hostable servers
  if (serverListing.server.importedServer?.isHostable) {
    deploymentsCount = await db.serverDeployment.count({
      where: { serverOid: serverListing.serverOid }
    });
    serverSessionsCount = await db.serverSession.count({
      where: { serverDeployment: { serverOid: serverListing.serverOid } }
    });

    let serverMessagesCountAgg = await db.serverSession.aggregate({
      where: { serverDeployment: { serverOid: serverListing.serverOid } },
      _sum: {
        totalProductiveServerMessageCount: true,
        totalProductiveClientMessageCount: true
      }
    });

    serverMessagesCount =
      (serverMessagesCountAgg._sum.totalProductiveServerMessageCount ?? 0) +
      (serverMessagesCountAgg._sum.totalProductiveClientMessageCount ?? 0);

    repoStarsCount = serverListing.server.importedServer?.repository?.starCount ?? 0;

    // Calculate rank based on various factors
    rank = Math.ceil(
      repoStarsCount * 5 +
        deploymentsCount * 0.1 +
        serverSessionsCount * 0.3 +
        serverMessagesCount * 0.01
    );

    // Boost rank for official servers
    if (!!serverListing.server.importedServer?.isOfficial) rank = Math.ceil(rank * 3);

    rank = Math.min(rank, 1_000_000_000);
  } else {
    rank = -1;
  }

  await db.serverListing.updateMany({
    where: { oid: serverListing.oid },
    data: {
      deploymentsCount,
      repoStarsCount,
      serverSessionsCount,
      serverMessagesCount,

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
