import { delay } from '@lowerdeck/delay';
import { ObjectStorageClient } from 'object-storage-client';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL, 1000 * 60 * 10);

let initBuckets = async () => {
  await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
};

(async () => {
  while (true) {
    try {
      await initBuckets();
      return;
    } catch (err) {
      console.error('Error initializing storage buckets, retrying...');
    }

    await delay(5000);
  }
})();
