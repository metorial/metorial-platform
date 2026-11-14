import { delay } from '@lowerdeck/delay';
import { ObjectStorageClient } from 'object-storage-client';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL, 1000 * 60 * 10);

export let getEventPayloadsBucketName = () => env.storage.EVENT_PAYLOADS_BUCKET_NAME;
export let getChatEventPayloadsBucketName = () => env.storage.CHAT_EVENT_PAYLOADS_BUCKET_NAME;
export let getDeliveryPayloadsBucketName = () =>
  env.storage.EVENT_DELIVERY_PAYLOADS_BUCKET_NAME;
export let getStorage = () => storage;

export let initBuckets = async () => {
  await getStorage().upsertBucket(getDeliveryPayloadsBucketName());
};

(async () => {
  while (true) {
    try {
      await initBuckets();
      return;
    } catch (error) {
      console.error('Error initializing event delivery object storage bucket, retrying...');
      console.error(error);
    }

    await delay(5000);
  }
})();
