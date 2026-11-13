import { delay } from '@lowerdeck/delay';
import type { WorkspaceStore } from '@metorial/review-engine';
import { ObjectStorageClient } from 'object-storage-client';
import { env } from '../env';

let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL, 1000 * 60 * 10);

let bucket = () => env.storage.SECURITY_REVIEW_BUCKET_NAME;

export let workspaceKeyFor = (d: { scope: 'global' | 'tenant'; reviewId: string }) =>
  `${d.scope}/${d.reviewId}/workspace.json.gz`;

export let workspaceStore: WorkspaceStore = {
  async load(key) {
    try {
      let object = await storage.getObject(bucket(), key);
      return new Uint8Array(object.data);
    } catch {
      return null;
    }
  },

  async save(key, data) {
    await storage.putObject(bucket(), key, Buffer.from(data), 'application/gzip');
  }
};

(async () => {
  while (true) {
    try {
      await storage.upsertBucket(bucket());
      return;
    } catch (error) {
      console.error('Error initializing security review object storage bucket, retrying...');
      console.error(error);
    }

    await delay(5000);
  }
})();
