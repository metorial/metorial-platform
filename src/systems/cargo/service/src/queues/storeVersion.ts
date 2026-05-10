import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { storeVersionService } from '../services';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;
let dirtyAgeMs = 60 * 60 * 1000;

export let storeVersionManyQueue = createQueue<{
  cursorOid?: string;
}>({
  redisUrl,
  name: 'cargo/store/version/many',
  workerOpts: {
    concurrency: 1
  }
});

export let storeVersionSingleQueue = createQueue<{
  storeId: string;
  expectedDirtyAt: string;
}>({
  redisUrl,
  name: 'cargo/store/version/single',
  workerOpts: {
    concurrency: 5
  }
});

export let storeVersionManyProcessor = storeVersionManyQueue.process(async data => {
  let result = await storeVersionService.listStoreIdsReadyForVersioning({
    cursorOid: data.cursorOid,
    limit: batchSize,
    dirtyBefore: new Date(Date.now() - dirtyAgeMs)
  });

  if (result.stores.length > 0) {
    await storeVersionSingleQueue.addMany(
      result.stores.map(store => ({
        storeId: store.storeId,
        expectedDirtyAt: store.dirtyAt.toISOString()
      }))
    );
  }

  if (result.nextCursorOid) {
    await storeVersionManyQueue.add({
      cursorOid: result.nextCursorOid
    });
  }
});

export let storeVersionSingleProcessor = storeVersionSingleQueue.process(async data => {
  await storeVersionService.createStoreVersionSnapshot({
    storeId: data.storeId,
    expectedDirtyAt: new Date(data.expectedDirtyAt)
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
