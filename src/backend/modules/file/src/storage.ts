import { delay } from '@mtsrc/delay';
import { ObjectStorageClient } from '@metorial-platform-systems/object-storage-client';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL);

export let getOssFilesBucketName = () => env.storage.FILES_BUCKET_NAME;
export let getStorage = () => storage;

export let initBuckets = async () => {
  await getStorage().upsertBucket(getOssFilesBucketName());
};

(async () => {
  while (true) {
    try {
      await initBuckets();
      return;
    } catch (error) {
      console.error('Error initializing object storage buckets, retrying...');
      console.error(error);
    }

    await delay(5000);
  }
})();
