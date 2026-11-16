import { createHash, randomUUID } from 'node:crypto';
import { type ExportStore, ExportUploadNotFoundError } from '../src/lib/exportStore';

type Upload = {
  key: string;
  initiated: Date;
  parts: Map<number, { etag: string; data: Buffer }>;
};

// Follows the durable multipart rules of the object store: parts are replaceable by number, all
// but the last must reach `minPartSize`, and a completed upload is gone.
export let createMemoryExportStore = (d: { minPartSize?: number } = {}) => {
  let uploads = new Map<string, Upload>();
  let objects = new Map<string, Buffer>();
  let aborted: string[] = [];
  let partUploads = 0;

  let uploadOf = (key: string, uploadId: string) => {
    let upload = uploads.get(uploadId);
    if (!upload || upload.key != key)
      throw new ExportUploadNotFoundError(`Unknown upload ${uploadId}`);
    return upload;
  };

  let store: ExportStore = {
    start: async key => {
      let uploadId = randomUUID();
      uploads.set(uploadId, { key, initiated: new Date(), parts: new Map() });
      return uploadId;
    },

    uploadPart: async (key, uploadId, part, data) => {
      let etag = createHash('sha256').update(data).digest('hex');
      uploadOf(key, uploadId).parts.set(part, { etag, data: Buffer.from(data) });
      partUploads++;
      return { etag, size: data.length };
    },

    complete: async (key, uploadId, parts) => {
      let upload = uploadOf(key, uploadId);
      let buffers = parts.map((part, index) => {
        let stored = upload.parts.get(part.part);
        if (part.part != index + 1 || !stored || stored.etag != part.etag) {
          throw new Error(`Invalid part ${part.part}`);
        }
        if (index < parts.length - 1 && stored.data.length < (d.minPartSize ?? 0)) {
          throw new Error(`Part ${part.part} is too small`);
        }
        return stored.data;
      });

      let object = Buffer.concat(buffers);
      objects.set(key, object);
      uploads.delete(uploadId);
      return { size: object.length };
    },

    abort: async (_key, uploadId) => {
      if (uploads.delete(uploadId)) aborted.push(uploadId);
    },

    head: async key => (objects.has(key) ? { size: objects.get(key)!.length } : null),

    delete: async key => {
      objects.delete(key);
    },

    listUploads: async prefix =>
      [...uploads]
        .filter(([, upload]) => upload.key.startsWith(prefix))
        .map(([uploadId, upload]) => ({
          key: upload.key,
          uploadId,
          initiated: upload.initiated
        })),

    downloadUrl: async (key, expiresInSeconds) => `memory://${key}?expires=${expiresInSeconds}`
  };

  return {
    store,
    uploads,
    objects,
    aborted,
    partUploads: () => partUploads
  };
};
