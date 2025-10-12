import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { codeWorkspaceClient } from '../lib/codeWorkspace';
import { codeBucketService } from '../services';

export let copyFromToBucketQueue = createQueue<{
  sourceBucketId: string;
  targetBucketId: string;
}>({
  name: 'cbk/cpy/tf-buk'
});

export let copyFromToBucketQueueProcessor = copyFromToBucketQueue.process(async data => {
  let sourceBucket = await db.codeBucket.findFirstOrThrow({
    where: { id: data.sourceBucketId }
  });
  let targetBucket = await db.codeBucket.findFirstOrThrow({
    where: { id: data.targetBucketId }
  });

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: sourceBucket.id });

  await codeWorkspaceClient.cloneBucket({
    sourceBucketId: sourceBucket.id,
    newBucketId: targetBucket.id
  });

  await db.codeBucket.updateMany({
    where: { id: targetBucket.id },
    data: { status: 'ready' }
  });
});
