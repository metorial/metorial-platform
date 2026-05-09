import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../env';
import { documentCleanupService } from '../services';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;

export let documentCleanupManyQueue = createQueue<{ cursor?: string }>({
  redisUrl,
  name: 'cargo/doc/cleanup/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentCleanupSingleQueue = createQueue<{ documentVersionId: string }>({
  redisUrl,
  name: 'cargo/doc/cleanup/single',
  workerOpts: {
    concurrency: 5
  }
});

export let documentCleanupManyProcessor = documentCleanupManyQueue.process(async data => {
  let versions = await documentCleanupService.listStaleDocumentVersions({
    cursor: data.cursor,
    limit: batchSize
  });
  if (versions.length === 0) return;

  await documentCleanupSingleQueue.addMany(
    versions.map(version => ({
      documentVersionId: version.id
    }))
  );

  if (versions.length === batchSize) {
    await documentCleanupManyQueue.add({
      cursor: versions[versions.length - 1]!.id
    });
  }
});

export let documentCleanupSingleProcessor = documentCleanupSingleQueue.process(async data => {
  await documentCleanupService.cleanupDocumentVersion({
    documentVersionId: data.documentVersionId
  });
});

export let documentCleanupCron = createCron(
  {
    redisUrl,
    name: 'cargo/doc/cleanup/cron',
    cron: '0 * * * *'
  },
  async () => {
    await documentCleanupManyQueue.add({});
  }
);

export let documentCleanupProcessors = combineQueueProcessors([
  documentCleanupManyProcessor,
  documentCleanupSingleProcessor,
  documentCleanupCron
]);
