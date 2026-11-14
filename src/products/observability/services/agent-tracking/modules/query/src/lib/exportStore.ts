import { ObjectStorageClient, ObjectStorageError } from 'object-storage-client';
import { env } from '../env';

export type ExportUpload = { key: string; uploadId: string; initiated: Date | null };

export type ExportStore = {
  start(
    key: string,
    d: { contentType: string; metadata: Record<string, string> }
  ): Promise<string>;
  uploadPart(
    key: string,
    uploadId: string,
    part: number,
    data: Buffer
  ): Promise<{ etag: string; size: number }>;
  complete(
    key: string,
    uploadId: string,
    parts: { part: number; etag: string }[]
  ): Promise<{ size: number }>;
  abort(key: string, uploadId: string): Promise<void>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
  listUploads(prefix: string): Promise<ExportUpload[]>;
  downloadUrl(key: string, expiresInSeconds: number): Promise<string>;
};

export class ExportUploadNotFoundError extends Error {}

let isNotFound = (error: unknown) =>
  error instanceof ObjectStorageError && error.statusCode == 404;

export let objectStorageExportStore = (
  client: ObjectStorageClient,
  bucket: string
): ExportStore => {
  let ready: Promise<unknown> | undefined;
  let ensureBucket = async () => {
    ready ??= client.upsertBucket(bucket).catch(error => {
      ready = undefined;
      throw error;
    });
    await ready;
  };

  let notFoundAware = async <T>(run: () => Promise<T>) => {
    try {
      return await run();
    } catch (error) {
      if (isNotFound(error)) throw new ExportUploadNotFoundError((error as Error).message);
      throw error;
    }
  };

  return {
    start: async (key, d) => {
      await ensureBucket();
      return await client.startMultipartUpload(bucket, key, d.contentType, d.metadata);
    },

    uploadPart: async (key, uploadId, part, data) =>
      notFoundAware(async () => {
        let uploaded = await client.uploadPart(bucket, key, uploadId, part, data);
        return { etag: uploaded.etag, size: uploaded.size };
      }),

    complete: async (key, uploadId, parts) =>
      notFoundAware(async () => ({
        size: (await client.completeMultipartUpload(bucket, key, uploadId, parts)).size
      })),

    abort: async (key, uploadId) => {
      await client.abortMultipartUpload(bucket, key, uploadId);
    },

    head: async key => {
      try {
        return { size: (await client.headObject(bucket, key)).size };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    delete: async key => {
      try {
        await client.deleteObject(bucket, key);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },

    listUploads: async prefix => {
      await ensureBucket();
      return (await client.listMultipartUploads(bucket, prefix)).map(upload => ({
        key: upload.key,
        uploadId: upload.uploadId,
        initiated: upload.initiated ? new Date(upload.initiated) : null
      }));
    },

    downloadUrl: async (key, expiresInSeconds) =>
      (await client.getPublicURL(bucket, key, expiresInSeconds)).url
  };
};

let override: ExportStore | null | undefined;
let configured: ExportStore | null | undefined;

export let setExportStore = (store: ExportStore | null | undefined) => {
  override = store;
};

export let getExportStore = (): ExportStore | null => {
  if (override !== undefined) return override;

  if (configured === undefined) {
    let url = env.storage.OBJECT_STORAGE_URL;
    configured = url
      ? objectStorageExportStore(new ObjectStorageClient(url), env.query.exportBucket)
      : null;
  }

  return configured;
};
