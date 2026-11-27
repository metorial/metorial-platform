import { PublicUrlPurpose } from 'object-storage-client';
import type { SlateAttachmentUpload } from '@mtsrc/slates-hub-db/client';
import { env } from '@mtsrc/slates-hub-env/env';
import { storage } from '@mtsrc/slates-hub-storage/storage';

let MiB = 1024 * 1024;

let PART_SIZE_BYTES = 16 * MiB;
// Limits of object storage's public multipart uploads.
let MAX_PART_SIZE_BYTES = 75 * MiB;
export let MAX_UPLOAD_PARTS = 10_000;
export let MAX_PARTS_PER_SIGNING = 8;

let SIGNED_URL_TTL_SECONDS = 5 * 60;

let MANIFEST_HEADER = 'x-metorial-upload-manifest';

export type MultipartUpload = SlateAttachmentUpload & {
  multipartUploadId: string;
  partSizeBytes: number;
  declaredSizeBytes: number;
};

export let isMultipartUpload = (upload: SlateAttachmentUpload): upload is MultipartUpload =>
  !!upload.multipartUploadId && !!upload.partSizeBytes && !!upload.declaredSizeBytes;

export let planUploadParts = (sizeBytes: number) => {
  let partSizeBytes = Math.max(
    PART_SIZE_BYTES,
    Math.ceil(sizeBytes / MAX_UPLOAD_PARTS / MiB) * MiB
  );
  if (partSizeBytes > MAX_PART_SIZE_BYTES) return null;

  return { partSizeBytes, partCount: Math.ceil(sizeBytes / partSizeBytes) };
};

export let uploadPartCount = (upload: MultipartUpload) =>
  Math.ceil(upload.declaredSizeBytes / upload.partSizeBytes);

let uploadPartSize = (upload: MultipartUpload, number: number) =>
  Math.min(
    upload.partSizeBytes,
    upload.declaredSizeBytes - (number - 1) * upload.partSizeBytes
  );

// Signatures don't cover the host, so the URL can move to wherever the runtime reaches object
// storage's public listener; only the trailing `depth` path segments name the object.
let rerootUploadUrl = (url: string, depth: number) => {
  let base = env.storage.SLATES_LIVE_UPLOAD_BASE_URL;
  if (!base) return url;

  let parsed = new URL(url);
  let suffix = parsed.pathname.split('/').slice(-depth).join('/');

  return `${base.replace(/\/+$/, '')}/${suffix}${parsed.search}`;
};

let expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export let signSingleUpload = async (
  upload: SlateAttachmentUpload & { declaredSizeBytes: number }
) => {
  let signed = await storage.getPublicURL(
    upload.storageBucket,
    upload.storageKey,
    SIGNED_URL_TTL_SECONDS,
    PublicUrlPurpose.Upload,
    upload.declaredSizeBytes
  );

  return {
    uploadUrl: rerootUploadUrl(signed.url, upload.storageKey.split('/').length + 1),
    uploadHeaders: signed.headers,
    expiresAt: expiresAt(signed.expires_in)
  };
};

export let signUploadParts = async (upload: MultipartUpload, numbers: number[]) => {
  let manifests = await storage.getPartManifests(
    upload.storageBucket,
    upload.storageKey,
    upload.multipartUploadId,
    SIGNED_URL_TTL_SECONDS,
    numbers.map(number => ({ number, size: uploadPartSize(upload, number) }))
  );
  let partsExpireAt = expiresAt(SIGNED_URL_TTL_SECONDS);

  return manifests.map(manifest => ({
    number: manifest.number,
    sizeBytes: uploadPartSize(upload, manifest.number),
    url: rerootUploadUrl(manifest.url, 1),
    method: 'PUT' as const,
    headers: { [MANIFEST_HEADER]: manifest.manifest },
    expiresAt: partsExpireAt
  }));
};

export let completeUploadParts = (upload: MultipartUpload, receipts: string[]) =>
  storage.completePublicMultipartUpload(
    upload.storageBucket,
    upload.storageKey,
    upload.multipartUploadId,
    upload.declaredSizeBytes,
    upload.partSizeBytes,
    receipts
  );
