import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { codeBucketService } from '../../services/codeBucket';

export let copyFromToBucketQueue = createQueue<{
  sourceBucketId: string;
  targetBucketId: string;
}>({
  name: 'ori/cpy/tf-buk',
  redisUrl: env.service.REDIS_URL
});

export let copyFromToBucketQueueProcessor = copyFromToBucketQueue.process(async data => {
  let sourceBucket = await db.codeBucket.findFirstOrThrow({
    where: { id: data.sourceBucketId }
  });
  let targetBucket = await db.codeBucket.findFirstOrThrow({
    where: { id: data.targetBucketId }
  });

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: sourceBucket.id });

  await codeBucketClient.cloneBucket({
    sourceBucketId: sourceBucket.id,
    newBucketId: targetBucket.id
  });

  await db.codeBucket.updateMany({
    where: { id: targetBucket.id },
    data: { status: 'ready' }
  });
});
