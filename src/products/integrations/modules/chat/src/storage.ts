import { delay } from '@lowerdeck/delay';
import { ObjectStorageClient } from 'object-storage-client';
import { env } from './env';

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL, 1000 * 60 * 10);

export let getChatEventPayloadsBucketName = () => env.storage.CHAT_EVENT_PAYLOADS_BUCKET_NAME;

export let getChatEventPayloadObject = async (key: string) =>
  await storage.getObject(getChatEventPayloadsBucketName(), key);

export let initBuckets = async () => {
  await storage.upsertBucket(getChatEventPayloadsBucketName());
};

(async () => {
  while (true) {
    try {
      await initBuckets();
      return;
    } catch (error) {
      console.error(
        'Error initializing chat event payload object storage bucket, retrying...'
      );
      console.error(error);
    }

    await delay(5000);
  }
})();
