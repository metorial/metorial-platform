import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { storage } from '../../storage';
import {
  getRetentionCutoffDate,
  RETENTION_BATCH_SIZE,
  retentionStorageCleanupWorkerOpts
} from '../retention/_config';

let UPLOAD_RETENTION_DAYS = 1;

export let slateAttachmentCleanupCron = createCron(
  {
    name: 'shub/att/cleanup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 9 * * *'
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
        createdAt: { lt: getRetentionCutoffDate(UPLOAD_RETENTION_DAYS) },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true, status: true, storageBucket: true, storageKey: true }
    });
    if (uploads.length === 0) return;

    await slateAttachmentUploadCleanupSingleQueue.addMany(
      uploads.map(upload => ({
        uploadId: upload.id,
        deleteObject: upload.status !== 'confirmed',
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
  deleteObject: boolean;
  bucket: string;
  key: string;
}>({
  name: 'shub/att/upload/cleanup/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let slateAttachmentUploadCleanupSingleQueueProcessor =
  slateAttachmentUploadCleanupSingleQueue.process(async data => {
    if (data.deleteObject) {
      await storage.deleteObject(data.bucket, data.key).catch(() => {});
    }

    await db.slateAttachmentUpload.deleteMany({ where: { id: data.uploadId } });
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
    let selfStored = attachments.filter(a => a.digest === null);

    if (digestBacked.length > 0) {
      await slateAttachmentCleanupSingleQueue.addMany(
        digestBacked.map(attachment => ({
          attachmentId: attachment.id,
          digest: Buffer.from(attachment.digest).toString('hex')
        }))
      );
    }

    if (selfStored.length > 0) {
      await slateAttachmentStoredContentCleanupQueue.addMany(
        selfStored.map(attachment => ({ attachmentId: attachment.id }))
      );
    }

    await slateAttachmentCleanupManyQueue.add({
      cursor: attachments[attachments.length - 1]!.id
    });
  }
);

export let slateAttachmentStoredContentCleanupQueue = createQueue<{
  attachmentId: string;
}>({
  name: 'shub/att/stored-content/cleanup',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let slateAttachmentStoredContentCleanupQueueProcessor =
  slateAttachmentStoredContentCleanupQueue.process(async data => {
    let now = new Date();
    let attachment = await db.slateAttachment.findFirst({
      where: { id: data.attachmentId, expiresAt: { lt: now } }
    });
    if (!attachment || attachment.digest) return;

    await db.slateInvocationAttachment.deleteMany({
      where: { attachmentsOid: attachment.oid }
    });
    await db.slateAttachment.deleteMany({
      where: { oid: attachment.oid, expiresAt: { lt: now } }
    });

    if (attachment.storageBucket && attachment.storageKey) {
      await storage
        .deleteObject(attachment.storageBucket, attachment.storageKey)
        .catch(() => {});
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
    let attachment = await db.slateAttachment.findFirst({
      where: { id: data.attachmentId, expiresAt: { lt: now } }
    });

    if (attachment) {
      await db.slateInvocationAttachment.deleteMany({
        where: { attachmentsOid: attachment.oid }
      });

      await db.slateAttachment.deleteMany({
        where: { oid: attachment.oid, expiresAt: { lt: now } }
      });
    }

    let digest = Buffer.from(data.digest, 'hex');

    let isDigestStillTracked = await db.slateAttachment.findFirst({
      where: { digest },
      select: { oid: true }
    });
    if (isDigestStillTracked) return;

    let blob = await db.slateAttachmentBlob.findUnique({ where: { digest } });
    if (!blob) return;

    await db.slateAttachmentBlob.deleteMany({ where: { oid: blob.oid } });
    await storage.deleteObject(blob.storageBucket, blob.storageKey).catch(() => {});
  });
