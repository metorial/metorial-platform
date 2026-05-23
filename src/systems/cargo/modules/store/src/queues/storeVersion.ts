import { createCron } from '@mtsrc/cron';
import { combineQueueProcessors, createQueue } from '@mtsrc/queue';
import { db, env } from '@metorial-cargo/db';
import { storeVersionService } from '@metorial-cargo/module-store';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;
let dirtyAgeMs = 60 * 60 * 1000;

export let storeVersionManyQueue = createQueue<{
  cursor?: string;
}>({
  redisUrl,
  name: 'cargo/store/version/many',
  workerOpts: {
    concurrency: 1
  }
});

export let storeVersionSingleQueue = createQueue<{
  storeId: string;
  expectedDirtyAt: Date;
}>({
  redisUrl,
  name: 'cargo/store/version/single',
  workerOpts: {
    concurrency: 5
  }
});

export let storeVersionManyProcessor = storeVersionManyQueue.process(async data => {
  let dirtyBefore = new Date(Date.now() - dirtyAgeMs);
  let stores = await db.store.findMany({
    where: {
      dirtyAt: {
        not: null,
        lte: dirtyBefore
      },
      id: data.cursor
        ? {
            gt: data.cursor
          }
        : undefined
    },
    orderBy: {
      id: 'asc'
    },
    take: batchSize,
    select: {
      oid: true,
      id: true,
      dirtyAt: true
    }
  });

  if (stores.length > 0) {
    await storeVersionSingleQueue.addMany(
      stores.map(store => ({
        storeId: store.id,
        expectedDirtyAt: store.dirtyAt!
      }))
    );
  }

  if (stores.length === batchSize) {
    await storeVersionManyQueue.add({
      cursor: stores[stores.length - 1]!.id
    });
  }
});

export let storeVersionSingleProcessor = storeVersionSingleQueue.process(async data => {
  await storeVersionService.createStoreVersionSnapshot({
    storeId: data.storeId,
    expectedDirtyAt: data.expectedDirtyAt
  });
});

export let storeVersionCron = createCron(
  {
    redisUrl,
    name: 'cargo/store/version/cron',
    cron: '*/15 * * * *'
  },
  async () => {
    await storeVersionManyQueue.add({});
  }
);

export let storeVersionProcessors = combineQueueProcessors([
  storeVersionManyProcessor,
  storeVersionSingleProcessor,
  storeVersionCron
]);
