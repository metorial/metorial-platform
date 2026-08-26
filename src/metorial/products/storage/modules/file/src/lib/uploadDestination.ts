import { ObjectStorageError } from 'object-storage-client';

export type UploadStreamDestination =
  | { type: 'signed_url'; url: string }
  | { type: 'internal'; bucket: string; key: string };

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
