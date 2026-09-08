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
    await slateAttachmentUploadCleanupManyQueue.add({});
  }
);

export let slateAttachmentUploadCleanupManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'shub/att/upload/cleanup/many',
  redisUrl: env.service.REDIS_URL
});

export let slateAttachmentUploadCleanupManyQueueProcessor =
  slateAttachmentUploadCleanupManyQueue.process(async data => {
    let uploads = await db.slateAttachmentUpload.findMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true, storageBucket: true, storageKey: true }
    });
    if (uploads.length === 0) return;

    await slateAttachmentUploadCleanupSingleQueue.addMany(
      uploads.map(upload => ({
        uploadId: upload.id,
        bucket: upload.storageBucket,
        key: upload.storageKey
      }))
    );

    await slateAttachmentUploadCleanupManyQueue.add({
      cursor: uploads[uploads.length - 1]!.id
    });
  });

export let slateAttachmentUploadCleanupSingleQueue = createQueue<{
  uploadId: string;
  bucket: string;
  key: string;
}>({
  name: 'shub/att/upload/cleanup/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let slateAttachmentUploadCleanupSingleQueueProcessor =
  slateAttachmentUploadCleanupSingleQueue.process(async data => {
    let upload = await db.slateAttachmentUpload.findUnique({ where: { id: data.uploadId } });
    if (!upload || upload.status !== 'pending' || upload.expiresAt >= new Date()) return;

    await storage.deleteObject(data.bucket, data.key).catch(() => {});

    await db.slateAttachmentUpload.updateMany({
      where: { id: data.uploadId, status: 'pending' },
      data: { status: 'expired' }
    });
  });

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

    let digestBacked = attachments.filter(
      (a): a is typeof a & { digest: Uint8Array } => a.digest !== null
    );
    let uploadBacked = attachments.filter(a => a.digest === null);

    if (digestBacked.length > 0) {
      await slateAttachmentCleanupSingleQueue.addMany(
        digestBacked.map(attachment => ({
          attachmentId: attachment.id,
          digest: Buffer.from(attachment.digest).toString('hex')
        }))
      );
    }

    if (uploadBacked.length > 0) {
      await slateAttachmentUploadedContentCleanupQueue.addMany(
        uploadBacked.map(attachment => ({ attachmentId: attachment.id }))
      );
    }

    await slateAttachmentCleanupManyQueue.add({
      cursor: attachments[attachments.length - 1]!.id
    });
  }
);

export let slateAttachmentUploadedContentCleanupQueue = createQueue<{
  attachmentId: string;
}>({
  name: 'shub/att/uploaded-content/cleanup',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let slateAttachmentUploadedContentCleanupQueueProcessor =
  slateAttachmentUploadedContentCleanupQueue.process(async data => {
    let now = new Date();
    let attachment = await db.slateAttachment.findFirst({
      where: { id: data.attachmentId, expiresAt: { lt: now } }
    });
    if (!attachment) return;

    let upload = await db.slateAttachmentUpload.findFirst({
      where: { attachmentOid: attachment.oid }
    });

    await db.slateInvocationAttachment.deleteMany({
      where: { attachmentsOid: attachment.oid }
    });
    await db.slateAttachment.deleteMany({
      where: { oid: attachment.oid, expiresAt: { lt: now } }
    });

    if (upload) {
      await storage.deleteObject(upload.storageBucket, upload.storageKey).catch(() => {});
    }
  });

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
