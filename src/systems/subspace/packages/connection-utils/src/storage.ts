import { delay } from '@lowerdeck/delay';
import { db } from '@metorial-subspace/db';
import { ObjectStorageClient } from 'object-storage-client';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL);

let initBuckets = async () => {
  await storage.upsertBucket(env.storage.MESSAGE_BUCKET_NAME);
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

export let sessionMessageBucketRecord = await db.sessionMessageStorageBucket.upsert({
  where: { bucket: env.storage.MESSAGE_BUCKET_NAME },
  update: {},
  create: {
    oid: Math.floor(Math.random() * 1_000_000),
    bucket: env.storage.MESSAGE_BUCKET_NAME
  }
});
