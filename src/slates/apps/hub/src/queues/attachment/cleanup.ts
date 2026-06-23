import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getStoredAttachmentsStorageKey } from '../../lib/invocation/store';
import { invocationsBucketRecord, storage } from '../../storage';
import { RETENTION_BATCH_SIZE, retentionStorageCleanupWorkerOpts } from '../retention/_config';

export let slateAttachmentCleanupCron = createCron(
  {
    name: 'shub/att/cleanup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    await slateAttachmentCleanupManyQueue.add({});
  }
);

export let slateAttachmentCleanupManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'shub/att/cleanup/many',
  redisUrl: env.service.REDIS_URL
});

export let slateAttachmentCleanupManyQueueProcessor = slateAttachmentCleanupManyQueue.process(
  async data => {
    let attachments = await db.slateAttachment.findMany({
      where: {
        expiresAt: { lt: new Date() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: {
        id: 'asc'
      },
      take: RETENTION_BATCH_SIZE,
      select: {
        id: true,
        digest: true
      }
    });
    if (attachments.length === 0) return;

    await slateAttachmentCleanupSingleQueue.addMany(
      attachments.map(attachment => ({
        attachmentId: attachment.id,
        digest: Buffer.from(attachment.digest).toString('hex')
      }))
    );

    await slateAttachmentCleanupManyQueue.add({
      cursor: attachments[attachments.length - 1]!.id
    });
  }
);

export let slateAttachmentCleanupSingleQueue = createQueue<{
  attachmentId: string;
  digest: string;
}>({
  name: 'shub/att/cleanup/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let slateAttachmentCleanupSingleQueueProcessor =
  slateAttachmentCleanupSingleQueue.process(async data => {
    let now = new Date();
    let attachment = await db.slateAttachment.findUnique({
      where: {
        id: data.attachmentId
      }
    });
    if (attachment && attachment.expiresAt >= now) return;

    if (attachment) {
      let current = await db.slateAttachment.findUnique({
        where: {
          oid: attachment.oid
        }
      });

      if (current && current.expiresAt < now) {
        await db.slateInvocationAttachment.deleteMany({
          where: {
            attachmentsOid: current.oid
          }
        });

        await db.slateAttachment.deleteMany({
          where: {
            oid: current.oid,
            expiresAt: { lt: now }
          }
        });
      }
    }

    let isDigestStillTracked = await db.slateAttachment.findFirst({
      where: {
        digest: Buffer.from(data.digest, 'hex')
      },
      select: {
        oid: true
      }
    });
    if (isDigestStillTracked) return;

    await storage.deleteObject(
      invocationsBucketRecord.bucket,
      getStoredAttachmentsStorageKey(data.digest)
    );
  });
