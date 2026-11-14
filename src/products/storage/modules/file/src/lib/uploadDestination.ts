import { ObjectStorageError } from 'object-storage-client';

export type SignedUploadUrl = { url: string; headers: Record<string, string> };

export type UploadStreamDestination =
  | ({ type: 'signed_url' } & SignedUploadUrl)
  | { type: 'internal'; bucket: string; key: string };

export let resolveUploadStreamDestination = async (d: {
  bucket: string;
  key: string;
  presign: () => Promise<SignedUploadUrl>;
}): Promise<UploadStreamDestination> => {
  try {
    let signed = await d.presign();
    return { type: 'signed_url', url: signed.url, headers: signed.headers };
  } catch (error) {
    if (error instanceof ObjectStorageError) {
      return { type: 'internal', bucket: d.bucket, key: d.key };
    }

    throw error;
  }
};
