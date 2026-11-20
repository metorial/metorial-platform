import type { ObjectMetadata } from 'object-storage-client';
import type { SlateAttachmentUpload, SlateInvocation } from '../../../prisma/generated/client';
import { db } from '../../db';
import { slateAttachmentUploadDeleteQueue } from '../../queues/attachment/uploadDelete';
import { storage } from '../../storage';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES_PER_INVOCATION
} from '../attachmentLimits';

let rejectUpload = async (
  upload: SlateAttachmentUpload,
  status: 'oversized' | 'size_mismatch'
) => {
  await db.slateAttachmentUpload.updateMany({
    where: { oid: upload.oid, status: 'processing' },
    data: { status }
  });

  await slateAttachmentUploadDeleteQueue.add({
    bucket: upload.storageBucket,
    key: upload.storageKey
  });
};

// Single PUT URLs don't bind a length, so the declared size is only enforced here; multipart
// uploads must have been completed through the live API, which object storage checks part by part.
export let claimAttachmentUpload = async (d: {
  referenceId: string;
  invocation: SlateInvocation;
}): Promise<{ upload: SlateAttachmentUpload; info: ObjectMetadata } | null> => {
  let upload = await db.slateAttachmentUpload.findFirst({
    where: { id: d.referenceId, invocationOid: d.invocation.oid }
  });
  if (!upload) return null;

  let claimed = await db.slateAttachmentUpload.updateMany({
    where: { oid: upload.oid, status: upload.multipartUploadId ? 'uploaded' : 'pending' },
    data: { status: 'processing' }
  });
  if (claimed.count === 0) return null;

  let info = await storage
    .headObject(upload.storageBucket, upload.storageKey)
    .catch(() => null);
  if (!info) {
    await db.slateAttachmentUpload.updateMany({
      where: { oid: upload.oid, status: 'processing' },
      data: { status: 'failed' }
    });
    return null;
  }

  if (upload.declaredSizeBytes !== null && info.size !== upload.declaredSizeBytes) {
    await rejectUpload(upload, 'size_mismatch');
    return null;
  }

  let alreadyConfirmed = await db.slateAttachmentUpload.aggregate({
    where: { invocationOid: d.invocation.oid, status: 'confirmed' },
    _sum: { sizeBytes: true }
  });
  let totalConfirmedBytes = (alreadyConfirmed._sum.sizeBytes ?? 0) + info.size;

  if (
    info.size > MAX_ATTACHMENT_SIZE_BYTES ||
    totalConfirmedBytes > MAX_TOTAL_ATTACHMENT_BYTES_PER_INVOCATION
  ) {
    await rejectUpload(upload, 'oversized');
    return null;
  }

  return { upload, info };
};

export let confirmAttachmentUpload = (d: {
  upload: SlateAttachmentUpload;
  info: ObjectMetadata;
}) =>
  db.slateAttachmentUpload.updateMany({
    where: { oid: d.upload.oid, status: 'processing' },
    data: { status: 'confirmed', sizeBytes: d.info.size }
  });
