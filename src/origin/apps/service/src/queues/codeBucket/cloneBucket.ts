import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';
import { codeBucketService } from '../../services/codeBucket';

export let cloneBucketQueue = createQueue<{
  bucketId: string;
}>({
  name: 'ori/cln/buk',
  redisUrl: env.service.REDIS_URL
});

export let cloneBucketQueueProcessor = cloneBucketQueue.process(async data => {
  let bucket = await db.codeBucket.findFirstOrThrow({
    where: { id: data.bucketId },
    include: { parent: true }
  });
  if (!bucket.parent) return;

  await codeBucketService.waitForCodeBucketReady({ codeBucketId: bucket.parent.id });

  await codeBucketClient.cloneBucket({
    sourceBucketId: bucket.parent.id,
    newBucketId: bucket.id
  });

  await db.codeBucket.updateMany({
    where: { id: bucket.id },
    data: { status: 'ready' }
  });
});
