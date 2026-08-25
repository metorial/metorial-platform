import { ObjectStorageError } from 'object-storage-client';

/**
 * Where a producer should write content it generates.
 *
 * A presigned URL keeps the object store private. Backends that cannot presign
 * fall back to the object-store HTTP API, which is only reachable inside the
 * cluster anyway.
 */
export type UploadStreamDestination =
  | { type: 'signed_url'; url: string }
  | { type: 'internal'; bucket: string; key: string };

/**
 * Prefers a presigned URL and falls back to an internal destination when the
 * configured backend cannot presign, which is the case for the local backend
 * used in development.
 *
 * Only storage errors trigger the fallback; anything else means presigning was
 * available but something else went wrong, and hiding that would turn a real
 * failure into a silent change of transport.
 */
export let resolveUploadStreamDestination = async (d: {
  bucket: string;
  key: string;
  presign: () => Promise<string>;
}): Promise<UploadStreamDestination> => {
  try {
    return { type: 'signed_url', url: await d.presign() };
  } catch (error) {
    if (error instanceof ObjectStorageError) {
      return { type: 'internal', bucket: d.bucket, key: d.key };
    }

    throw error;
  }
};
