import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { storage } from '../../storage';

export let slateAttachmentUploadDeleteQueue = createQueue<{ bucket: string; key: string }>({
  name: 'shub/att/upload/delete',
  redisUrl: env.service.REDIS_URL
});

export let slateAttachmentUploadDeleteQueueProcessor =
  slateAttachmentUploadDeleteQueue.process(async data => {
    await storage.deleteObject(data.bucket, data.key);
  });
