import { delay } from '@lowerdeck/delay';
import { env } from './env';
import { ObjectStorageClient } from 'object-storage-client';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL);

export let getCargoFilesBucketName = () => env.storage.FILES_BUCKET_NAME;
export let getStorage = () => storage;

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
