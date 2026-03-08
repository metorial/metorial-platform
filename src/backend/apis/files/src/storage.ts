import { delay } from '@lowerdeck/delay';
import { getConfig } from '@metorial/config';
import { ObjectStorageClient } from 'object-storage-client';

let objectStorageConfig = getConfig().objectStorage;

export let storage = new ObjectStorageClient(objectStorageConfig.url);

export let getStorage = () => storage;

export let getOssFilesBucketName = () => {
  return objectStorageConfig.filesBucketName;
};

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
