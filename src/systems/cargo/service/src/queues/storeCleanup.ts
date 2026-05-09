import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { storeService } from '../services';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;

export let storeCleanupManyQueue = createQueue<{
  fileReferenceIds: string[];
  offset?: number;
}>({
  redisUrl,
  name: 'cargo/store/cleanup/many',
  workerOpts: {
    concurrency: 1
  }
});

export let storeCleanupSingleQueue = createQueue<{ fileReferenceId: string }>({
  redisUrl,
  name: 'cargo/store/cleanup/single',
  workerOpts: {
    concurrency: 5
  }
});

export let storeCleanupManyProcessor = storeCleanupManyQueue.process(async data => {
  let offset = data.offset ?? 0;
  let fileReferenceIds = data.fileReferenceIds.slice(offset, offset + batchSize);
  if (fileReferenceIds.length === 0) return;

  await storeCleanupSingleQueue.addMany(
    fileReferenceIds.map(fileReferenceId => ({
      fileReferenceId
    }))
  );

  if (offset + batchSize < data.fileReferenceIds.length) {
    await storeCleanupManyQueue.add({
      fileReferenceIds: data.fileReferenceIds,
      offset: offset + batchSize
    });
  }
});

export let storeCleanupSingleProcessor = storeCleanupSingleQueue.process(async data => {
  await storeService.cleanupStoreFileReference({
    fileReferenceId: data.fileReferenceId
  });
});

export let storeCleanupProcessors = combineQueueProcessors([
  storeCleanupManyProcessor,
  storeCleanupSingleProcessor
]);
