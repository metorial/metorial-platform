import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { codeWorkspaceClient } from '../lib/codeWorkspace';

export let importTemplateQueue = createQueue<{
  bucketId: string;
  templateId: string;
}>({
  name: 'cbk/tmp/imp'
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

  await codeWorkspaceClient.createBucketFromContents({
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
