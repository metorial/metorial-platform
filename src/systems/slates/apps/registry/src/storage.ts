import { delay } from '@mtsrc/delay';
import { ObjectStorageClient } from '@metorial-platform-systems/object-storage-client';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL);

let initBuckets = async () => {
  await storage.upsertBucket(env.storage.PACKAGE_BUCKET_NAME);
};

(async () => {
  while (true) {
    try {
      await initBuckets();
      return;
    } catch (_err) {
      console.error('Error initializing storage buckets, retrying...');
    }

    await delay(5000);
  }
})();
