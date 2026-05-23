import { delay } from '@mtsrc/delay';
import { ObjectStorageClient } from '@metorial-platform-systems/object-storage-client';
import { db } from './db';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL);

let initBuckets = async () => {
  await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
};

(async () => {
  while (true) {
    console.log('Initializing storage buckets...');

    try {
      await initBuckets();
      console.log('Storage buckets initialized successfully');
      return;
    } catch (_err) {
      console.error('Error initializing storage buckets, retrying...');
    }

    await delay(5000);
  }
})();

export let connectionLogsBucketRecord = await db.connectionLogsStorageBucket.upsert({
  where: { bucket: env.storage.LOGS_BUCKET_NAME },
  update: {},
  create: {
    oid: Math.floor(Math.random() * 1_000_000),
    bucket: env.storage.LOGS_BUCKET_NAME
  }
});
