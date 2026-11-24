import { badRequestError, createError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { ObjectStorageError } from 'object-storage-client';
import type { SlatePackImport } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import { isMirrorMode } from '../mode';
import { storage } from '../storage';
import { slatePackService } from './slatePack';
import { slatePackBatchService } from './slatePackBatch';

let MiB = 1024 * 1024;

let defaultMaxPackBytes = 8 * 1024 * MiB;

let defaultPartBytes = 8 * MiB;

let minPartBytes = 5 * MiB;

let maxPartBytes = 75 * MiB;

let maxParts = 10_000;

let maxManifestBatch = 8;

let manifestExpirationSecs = 10 * 60;

let uploadExpirationMs = 24 * 60 * 60 * 1000;

let maxFileNameLength = 255;

let payloadTooLargeError = createError({
  status: 413,
  code: 'payload_too_large',
  message: 'The slate pack is too large.'
});

let getMaxPackBytes = () => env.mirror.SLATES_PACK_MAX_BYTES ?? defaultMaxPackBytes;

let selectPartSize = (size: number) => {
  let configured = env.mirror.SLATES_PACK_UPLOAD_PART_BYTES ?? defaultPartBytes;
  let partSize = Math.min(Math.max(configured, minPartBytes), maxPartBytes);

  return Math.max(partSize, Math.ceil(size / maxParts));
};

let sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^\w.\- ]+/g, '_').slice(0, maxFileNameLength) || 'upload.slatepack';

let getPartCount = (packImport: SlatePackImport) =>
  Math.ceil(Number(packImport.size) / packImport.multipartPartSize!);

let issueManifests = async (packImport: SlatePackImport, partNumbers: number[]) => {
  let size = Number(packImport.size);
  let partSize = packImport.multipartPartSize!;
  let partCount = getPartCount(packImport);

  if (
    !partNumbers.length ||
    partNumbers.length > maxManifestBatch ||
    new Set(partNumbers).size !== partNumbers.length ||
    partNumbers.some(number => !Number.isInteger(number) || number < 1 || number > partCount)
  ) {
    throw new ServiceError(badRequestError({ message: 'Invalid slate pack part numbers.' }));
  }

  let expiresIn = Math.min(
    manifestExpirationSecs,
    Math.floor((+packImport.uploadExpiresAt! - Date.now()) / 1000)
  );
  if (expiresIn < 1) {
    throw new ServiceError(badRequestError({ message: 'The slate pack upload has expired.' }));
  }

  return await storage.getPartManifests(
    packImport.bucket,
    packImport.storageKey,
    packImport.multipartUploadId!,
    expiresIn,
    partNumbers.map(number => ({
      number,
      size: Math.min(partSize, size - (number - 1) * partSize)
    }))
  );
};

let getUploadingImport = async (d: { packImportId: string }) => {
  let packImport = await slatePackService.getImport({ id: d.packImportId });
  if (packImport.status !== 'uploading' || !packImport.multipartUploadId) {
    throw new ServiceError(
      badRequestError({ message: 'This slate pack is no longer being uploaded.' })
    );
  }

  return packImport;
};

let abortUpload = async (packImport: SlatePackImport, error: string) => {
  let failed = await db.slatePackImport.updateMany({
    where: { oid: packImport.oid, status: 'uploading' },
    data: { status: 'failed', error, completedAt: new Date() }
  });

  if (packImport.multipartUploadId) {
    await storage
      .abortMultipartUpload(
        packImport.bucket,
        packImport.storageKey,
        packImport.multipartUploadId
      )
      .catch(() => {});
  }

  return failed.count > 0;
};

class slatePackUploadServiceImpl {
  async startUpload(d: { fileName: string; size: number; batchId?: string }) {
    if (!isMirrorMode()) {
      throw new ServiceError(
        badRequestError({ message: 'Slate packs can only be imported in mirror mode.' })
      );
    }
    if (!Number.isSafeInteger(d.size) || d.size < 1) {
      throw new ServiceError(
        badRequestError({ message: 'The uploaded slate pack is empty.' })
      );
    }
    if (d.size > getMaxPackBytes()) throw new ServiceError(payloadTooLargeError());

    let batch = d.batchId
      ? await slatePackBatchService.getUploadingBatch({ id: d.batchId })
      : undefined;

    let ids = getId('slatePackImport');
    let bucket = env.storage.PACKAGE_BUCKET_NAME;
    let storageKey = `slate-packs/${ids.id}.slatepack`;
    let partSize = selectPartSize(d.size);

    let uploadId = await storage.startMultipartUpload(bucket, storageKey, 'application/zip');

    try {
      let packImport = await db.slatePackImport.create({
        data: {
          ...ids,
          status: 'uploading',
          fileName: sanitizeFileName(d.fileName),
          size: BigInt(d.size),
          bucket,
          storageKey,
          multipartUploadId: uploadId,
          multipartPartSize: partSize,
          uploadExpiresAt: new Date(Date.now() + uploadExpirationMs),
          batchOid: batch?.oid
        }
      });

      let partCount = getPartCount(packImport);
      let parts = await issueManifests(
        packImport,
        Array.from({ length: Math.min(partCount, maxManifestBatch) }, (_, index) => index + 1)
      );

      return { packImport, partSize, partCount, parts };
    } catch (err) {
      await storage.abortMultipartUpload(bucket, storageKey, uploadId).catch(() => {});
      throw err;
    }
  }

  async getPartManifests(d: { packImportId: string; partNumbers: number[] }) {
    let packImport = await getUploadingImport(d);
    return await issueManifests(packImport, d.partNumbers);
  }

  async completeUpload(d: { packImportId: string; receipts: string[] }) {
    let packImport = await slatePackService.getImport({ id: d.packImportId });
    if (packImport.status !== 'uploading') {
      if (packImport.status === 'failed') {
        throw new ServiceError(
          badRequestError({ message: 'This slate pack upload was canceled.' })
        );
      }

      return { packImport, completed: false };
    }

    if (d.receipts.length !== getPartCount(packImport)) {
      throw new ServiceError(
        badRequestError({ message: 'Every part of the slate pack must be uploaded.' })
      );
    }

    try {
      await storage.completePublicMultipartUpload(
        packImport.bucket,
        packImport.storageKey,
        packImport.multipartUploadId!,
        Number(packImport.size),
        packImport.multipartPartSize!,
        d.receipts
      );
    } catch (err) {
      if (err instanceof ObjectStorageError && err.statusCode === 400) {
        throw new ServiceError(
          badRequestError({ message: 'The slate pack parts could not be verified.' })
        );
      }
      throw err;
    }

    let completed = await db.slatePackImport.updateMany({
      where: { oid: packImport.oid, status: 'uploading' },
      data: { status: 'pending', multipartUploadId: null, uploadExpiresAt: null }
    });

    return {
      packImport: await slatePackService.getImport({ id: d.packImportId }),
      completed: completed.count > 0
    };
  }

  async cancelUpload(d: { packImportId: string }) {
    let packImport = await slatePackService.getImport({ id: d.packImportId });
    if (packImport.status === 'uploading') {
      await abortUpload(packImport, 'The upload was canceled.');
    }

    return await slatePackService.getImport({ id: d.packImportId });
  }

  async cleanupExpiredUploads() {
    let packImports = await db.slatePackImport.findMany({
      where: { status: 'uploading', uploadExpiresAt: { lt: new Date() } },
      take: 100
    });

    for (let packImport of packImports) {
      await abortUpload(packImport, 'The upload was never finished.');
    }

    return { cleaned: packImports.length };
  }
}

export let slatePackUploadService = Service.create(
  'slatePackUploadService',
  () => new slatePackUploadServiceImpl()
).build();
