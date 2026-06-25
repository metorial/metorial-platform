import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { codeBucketClient } from '../../lib/codeWorkspace';

export let importTemplateQueue = createQueue<{
  bucketId: string;
  templateId: string;
}>({
  name: 'ori/tmp/imp',
  redisUrl: env.service.REDIS_URL
});

export let importTemplateQueueProcessor = importTemplateQueue.process(async data => {
  let codeBucket = await db.codeBucket.findFirstOrThrow({
    where: { id: data.bucketId },
    include: { parent: true }
  });
  let template = await db.codeBucketTemplate.findFirstOrThrow({
    where: { id: data.templateId }
  });
  if (!codeBucket || !template) throw new QueueRetryError();

  await codeBucketClient.createBucketFromContents({
    newBucketId: codeBucket.id,
    contents: template.contents.map(f => ({
      path: f.path,
      content: Buffer.from(f.content, 'utf-8')
    }))
  });

  await db.codeBucket.updateMany({
    where: { id: codeBucket.id },
    data: { status: 'ready' }
  });
});
