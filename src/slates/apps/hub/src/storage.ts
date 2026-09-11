import { delay } from '@lowerdeck/delay';
import { ObjectStorageClient } from 'object-storage-client';
import { db } from './db';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL, 1000 * 60 * 10);

let initBuckets = async () => {
  await storage.upsertBucket(env.storage.INVOCATIONS_BUCKET_NAME);
};

(async () => {
  console.log('Ensuring storage buckets exist...');

  while (true) {
    try {
      await Promise.race([
        initBuckets(),
        delay(10000).then(() => {
          throw new Error('Storage bucket initialization timed out');
        })
      ]);
      console.log('Storage buckets are ready');
      return;
    } catch (err) {
      console.error('Error initializing storage buckets, retrying...', err);
    }

    await delay(5000);
  }
})();

export let invocationsBucketRecord = await db.slateInvocationStorageBucket.upsert({
  where: { bucket: env.storage.INVOCATIONS_BUCKET_NAME },
  update: {},
  create: {
    oid: Math.floor(Math.random() * 1_000_000),
    bucket: env.storage.INVOCATIONS_BUCKET_NAME
  }
});
