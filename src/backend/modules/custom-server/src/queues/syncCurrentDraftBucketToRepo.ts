import { db } from '@metorial/db';
import { codeBucketService } from '@metorial/module-code-bucket';
import { createQueue } from '@metorial/queue';

export let syncCurrentDraftBucketToRepoQueue = createQueue<{
  draftBucketOid: bigint;
  immutableBucketOid: bigint;
}>({
  name: 'csv/sncDrftBkRpo'
});

export let syncCurrentDraftBucketToRepoQueueProcessor =
  syncCurrentDraftBucketToRepoQueue.process(async data => {
    let draftCodeBucket = await db.codeBucket.findFirst({
      where: {
        oid: data.draftBucketOid
      }
    });
    let immutableCodeBucket = await db.codeBucket.findFirst({
      where: {
        oid: data.immutableBucketOid
      }
    });
    if (!draftCodeBucket || !immutableCodeBucket) throw new Error('retry ... not found');

    await codeBucketService.syncCodeBuckets({
      source: immutableCodeBucket,
      target: draftCodeBucket
    });
  });
