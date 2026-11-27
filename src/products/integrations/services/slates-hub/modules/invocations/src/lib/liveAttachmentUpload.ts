import { delay } from '@lowerdeck/delay';
import type { SlateAttachmentUpload } from '@mtsrc/slates-hub-db/client';
import { db } from '@mtsrc/slates-hub-db/db';
import { getId } from '@mtsrc/slates-hub-db/id';
import { invocationsBucketRecord, storage } from '@mtsrc/slates-hub-storage/storage';
import { slateAttachmentUploadDeleteQueue } from '../queues/attachment/uploadDelete';
import {
  isMultipartUpload,
  MAX_PARTS_PER_SIGNING,
  planUploadParts,
  signSingleUpload,
  signUploadParts,
  uploadPartCount
} from './liveUpload';

let UPLOAD_RECORD_TTL_SECONDS = 30 * 60;

let getUploadStorageKey = (uploadId: string) => `attachments/uploads/${uploadId}`;

export let findInvocationWithRetry = async (invocationId: string) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    let invocation = await db.slateInvocation.findFirst({ where: { id: invocationId } });
    if (invocation) return invocation;
    await delay(150);
  }
  return null;
};

export let findPendingUpload = (d: { referenceId: string; invocationId: string }) =>
  db.slateAttachmentUpload.findFirst({
    where: {
      id: d.referenceId,
      status: 'pending',
      expiresAt: { gt: new Date() },
      invocation: { id: d.invocationId }
    }
  });

// Slates that can't upload in parts get a single URL; object storage holds it to the declared size.
export let registerUpload = async (d: {
  invocationOid: bigint;
  mimeType?: string;
  filename?: string;
  sizeBytes: number;
  multipart: boolean;
}) => {
  let { oid, id } = getId('slateAttachmentUpload');
  let storageKey = getUploadStorageKey(id);
  let plan = d.multipart && d.sizeBytes > 0 ? planUploadParts(d.sizeBytes) : null;

  let multipartUploadId = plan
    ? await storage.startMultipartUpload(
        invocationsBucketRecord.bucket,
        storageKey,
        d.mimeType
      )
    : null;

  let upload = await db.slateAttachmentUpload.create({
    data: {
      oid,
      id,
      invocationOid: d.invocationOid,
      mimeType: d.mimeType,
      filename: d.filename,
      status: 'pending',
      storageBucket: invocationsBucketRecord.bucket,
      storageKey,
      declaredSizeBytes: d.sizeBytes,
      multipartUploadId,
      partSizeBytes: plan?.partSizeBytes,
      expiresAt: new Date(Date.now() + UPLOAD_RECORD_TTL_SECONDS * 1000)
    }
  });

  if (!isMultipartUpload(upload)) {
    return {
      referenceId: id,
      uploadMethod: 'PUT' as const,
      ...(await signSingleUpload({ ...upload, declaredSizeBytes: d.sizeBytes }))
    };
  }

  let partCount = uploadPartCount(upload);
  let firstParts = Array.from(
    { length: Math.min(partCount, MAX_PARTS_PER_SIGNING) },
    (_, i) => i + 1
  );

  return {
    referenceId: id,
    uploadMethod: 'MULTIPART' as const,
    partSizeBytes: upload.partSizeBytes,
    partCount,
    parts: await signUploadParts(upload, firstParts),
    expiresAt: upload.expiresAt.toISOString()
  };
};

export let discardUpload = async (upload: SlateAttachmentUpload) => {
  let discarded = await db.slateAttachmentUpload.updateMany({
    where: { oid: upload.oid, status: 'pending' },
    data: { status: 'failed' }
  });
  if (discarded.count === 0) return;

  if (upload.multipartUploadId) {
    await storage
      .abortMultipartUpload(upload.storageBucket, upload.storageKey, upload.multipartUploadId)
      .catch(() => {});
  }

  await slateAttachmentUploadDeleteQueue.add({
    bucket: upload.storageBucket,
    key: upload.storageKey
  });
};

export let recordUploadedSize = async (d: { uploadOid: bigint; size: number }) => {
  await db.slateAttachmentUpload.updateMany({
    where: { oid: d.uploadOid, status: 'pending' },
    data: { status: 'uploaded', sizeBytes: d.size }
  });
};
