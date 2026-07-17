import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '@metorial-cargo/db';
import { internalDocumentSyncService } from '../internal/documentSync';

let redisUrl = env.service.REDIS_URL;
let batchSize = 100;

export let documentVersionSyncManyQueue = createQueue<{
  parentDocumentVersionId: string;
  cursor?: string;
}>({
  redisUrl,
  name: 'cargo/doc/version-sync/many',
  workerOpts: {
    concurrency: 1
  }
});

export let documentVersionSyncSingleQueue = createQueue<{
  parentDocumentVersionId: string;
  childDocumentId: string;
}>({
  redisUrl,
  name: 'cargo/doc/version-sync/single',
  workerOpts: {
    concurrency: 5
  }
});

export let documentVersionSyncManyProcessor = documentVersionSyncManyQueue.process(async data => {
  let result = await internalDocumentSyncService.listSyncableChildDocumentIdsForVersionSync({
    parentDocumentVersionId: data.parentDocumentVersionId,
    cursor: data.cursor,
    limit: batchSize
  });

  if (result.childDocumentIds.length > 0) {
    await documentVersionSyncSingleQueue.addMany(
      result.childDocumentIds.map(childDocumentId => ({
        parentDocumentVersionId: data.parentDocumentVersionId,
        childDocumentId
      }))
    );
  }

  if (result.nextCursor) {
    await documentVersionSyncManyQueue.add({
      parentDocumentVersionId: data.parentDocumentVersionId,
      cursor: result.nextCursor
    });
  }
});

export let documentVersionSyncSingleProcessor = documentVersionSyncSingleQueue.process(
  async data => {
    let result = await internalDocumentSyncService.syncChildDocumentVersionFromParentVersion({
      parentDocumentVersionId: data.parentDocumentVersionId,
      childDocumentId: data.childDocumentId
    });

    if (result?.createdVersionId) {
      await documentVersionSyncManyQueue.add({
        parentDocumentVersionId: result.createdVersionId
      });
    }
  }
);

export let documentVersionSyncProcessors = combineQueueProcessors([
  documentVersionSyncManyProcessor,
  documentVersionSyncSingleProcessor
]);
