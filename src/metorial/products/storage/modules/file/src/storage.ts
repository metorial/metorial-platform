import { delay } from '@lowerdeck/delay';
import {
  ObjectStorageClient,
  ObjectStorageError,
  PublicUrlPurpose
} from 'object-storage-client';
import { env } from './env';
import { readObjectStream } from './lib/objectStream';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL, 1000 * 60 * 10);

export let getCargoFilesBucketName = () => env.storage.FILES_BUCKET_NAME;
export let getStorage = () => storage;

export let getObjectStream = async (bucket: string, key: string) =>
  await readObjectStream({ baseUrl: env.storage.OBJECT_STORAGE_URL, bucket, key });

/**
 * Presigns a read of a stored object, or returns null when the configured
 * backend cannot presign at all (the local filesystem backend, for instance).
 * Callers are expected to serve the bytes themselves in that case.
 */
export let presignObjectDownload = async (d: { key: string; expiresInSecs: number }) => {
  try {
    let res = await getStorage().getPublicURL(
      getCargoFilesBucketName(),
      d.key,
      d.expiresInSecs,
      PublicUrlPurpose.Retrieve
    );

    return res.url;
  } catch (error) {
    if (error instanceof ObjectStorageError) return null;
    throw error;
  }
};

export let initBuckets = async () => {
  await getStorage().upsertBucket(getCargoFilesBucketName());
};

(async () => {
  while (true) {
    try {
      await initBuckets();
      return;
    } catch (error) {
      console.error('Error initializing cargo object storage buckets, retrying...');
      console.error(error);
    }

    await delay(5000);
  }
})();
