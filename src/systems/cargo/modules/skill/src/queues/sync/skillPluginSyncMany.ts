import { createQueue } from '@lowerdeck/queue';
import { db, env, getId } from '@metorial-cargo/db';
import { syncStartQueue } from './start';

let batchSize = 100;

export let skillPluginSyncManyQueue = createQueue<{
  skillPluginId: string;
  cursor?: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/plugin/syncMany',
  workerOpts: {
    concurrency: 10
  }
});

export let skillPluginSyncManyQueueProcessor = skillPluginSyncManyQueue.process(async data => {
  if (!data.cursor) {
    let skillPlugin = await db.skillPlugin.findFirst({
      where: {
        id: data.skillPluginId
      },
      select: {
        destinationOid: true
      }
    });

    if (skillPlugin) {
      let sync = await db.skillDestinationSync.create({
        data: {
          ...getId('skillDestinationSync'),
          destinationOid: skillPlugin.destinationOid,
          status: 'pending'
        }
      });

      await syncStartQueue.add({
        skillDestinationSyncId: sync.id
      });
    }
  }

  let marketplacePlugins = await db.skillMarketplacePlugin.findMany({
    where: {
      status: 'active',
      id: data.cursor ? { gt: data.cursor } : undefined,
      skillPlugin: {
        id: data.skillPluginId
      },
      skillMarketplace: {
        status: 'active'
      }
    },
    orderBy: {
      id: 'asc'
    },
    take: batchSize,
    select: {
      id: true,
      skillMarketplace: {
        select: {
          destinationOid: true
        }
      }
    }
  });

  for (let marketplacePlugin of marketplacePlugins) {
    let sync = await db.skillDestinationSync.create({
      data: {
        ...getId('skillDestinationSync'),
        destinationOid: marketplacePlugin.skillMarketplace.destinationOid,
        status: 'pending'
      }
    });

    await syncStartQueue.add({
      skillDestinationSyncId: sync.id
    });
  }

  if (marketplacePlugins.length === batchSize) {
    await skillPluginSyncManyQueue.add({
      skillPluginId: data.skillPluginId,
      cursor: marketplacePlugins[marketplacePlugins.length - 1]!.id
    });
  }
});
