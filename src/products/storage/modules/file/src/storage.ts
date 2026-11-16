import { delay } from '@lowerdeck/delay';
import { openAsBlob } from 'node:fs';
import {
  ObjectStorageClient,
  ObjectStorageError,
  PublicUrlPurpose
} from 'object-storage-client';
import { env } from './env';

let storageTimeoutMs = 1000 * 60 * 10;

export let storage = new ObjectStorageClient(env.storage.OBJECT_STORAGE_URL, storageTimeoutMs);

export let getCargoFilesBucketName = () => env.storage.FILES_BUCKET_NAME;
export let getStorage = () => storage;

export let getObjectStream = async (bucket: string, key: string) => {
  let object = await getStorage().getObjectStream(bucket, key);

  return {
    stream: object.stream,
    contentType: object.metadata.content_type,
    size: object.metadata.size
  };
};

export let getObjectDigests = async (bucket: string, key: string) =>
  await getStorage().getObjectDigests(bucket, key);

export let putObjectStream = async (d: {
  bucket: string;
  key: string;
  body: ReadableStream<Uint8Array>;
  contentType?: string;
}) => await getStorage().putObject(d.bucket, d.key, d.body, d.contentType);

export let putObjectFile = async (d: {
  bucket: string;
  key: string;
  path: string;
  contentType?: string;
}) => await getStorage().putObject(d.bucket, d.key, await openAsBlob(d.path), d.contentType);

export let createZipJobFromSpecFile = async (d: {
  jobId: string;
  path: string;
  waitSeconds?: number;
}) =>
  await getStorage().createZipJob(d.jobId, await openAsBlob(d.path), {
    waitSeconds: d.waitSeconds
  });

export let presignObjectDownload = async (d: { key: string; expiresInSecs: number }) => {
  try {
    let res = await getStorage().getPublicURL(
      getCargoFilesBucketName(),
      d.key,
      d.expiresInSecs,
      PublicUrlPurpose.Retrieve
    );

    return res.url;
  } catch (error) {
    if (error instanceof ObjectStorageError) return null;
    throw error;
  }
};

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
