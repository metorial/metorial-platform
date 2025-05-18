import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';

let rankCron = createCron(
  {
    name: 'cat/rank/cron',
    cron: '0 * * * *'
  },
  async () => {
    await startRankQueue.add({});
  }
);

let startRankQueue = createQueue({
  name: 'cat/rank/start'
});

let processSingleRankQueue = createQueue<{ serverListingId: string }>({
  name: 'cat/rank/single',
  workerOpts: {
    concurrency: 1
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

    await processSingleRankQueue.addMany(
      servers.map(server => ({
        serverListingId: server.id
      }))
    );
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

  let deploymentsCount = await db.serverDeployment.count({
    where: { serverOid: serverListing.serverOid }
  });
  let serverSessionsCount = await db.serverSession.count({
    where: { serverDeployment: { serverOid: serverListing.serverOid } }
  });
  let serverMessagesCountAgg = await db.serverSession.aggregate({
    where: { serverDeployment: { serverOid: serverListing.serverOid } },
    _sum: {
      totalProductiveServerMessageCount: true,
      totalProductiveClientMessageCount: true
    }
  });

  let serverMessagesCount =
    (serverMessagesCountAgg._sum.totalProductiveServerMessageCount ?? 0) +
    (serverMessagesCountAgg._sum.totalProductiveClientMessageCount ?? 0);

  let repoStarsCount = serverListing.server.importedServer?.repository?.starCount ?? 0;
  let isOfficial = !!serverListing.server.importedServer?.isOfficial;

  let rank = Math.ceil(
    repoStarsCount * 5 +
      deploymentsCount * 0.1 +
      serverSessionsCount * 0.3 +
      serverMessagesCount * 0.01
  );

  if (isOfficial) rank = Math.ceil(rank * 3);

  rank = Math.min(rank, 1_000_000_000);

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
