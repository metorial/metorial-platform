import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { codeWorkspaceClient } from '../lib/codeWorkspace';
import { codeBucketService } from '../services';

export let cloneBucketQueue = createQueue<{
  bucketId: string;
}>({
  name: 'cbk/cln/buk'
});

export let cloneBucketQueueProcessor = cloneBucketQueue.process(async data => {
  let bucket = await db.codeBucket.findFirstOrThrow({
    where: { id: data.bucketId },
    include: { parent: true }
  });
  if (!bucket.parent) return;

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: bucket.parent.id });

  await codeWorkspaceClient.cloneBucket({
    sourceBucketId: bucket.parent.id,
    newBucketId: bucket.id
  });

  await db.codeBucket.updateMany({
    where: { id: bucket.id },
    data: { status: 'ready' }
  });
});
