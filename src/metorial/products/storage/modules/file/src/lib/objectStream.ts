import { openAsBlob } from 'node:fs';
import { ObjectStorageError } from 'object-storage-client';

export let objectStreamUrl = (d: { baseUrl: string; bucket: string; key: string }) =>
  `${d.baseUrl.replace(/\/$/, '')}/buckets/${d.bucket}/objects/${d.key}`;

// The storage client buffers request bodies (axios over Bun's node:http, even for streams and
// Blobs); a file-backed Blob passed to the native fetch is sent from disk instead.
export let writeObjectFile = async (d: {
  baseUrl: string;
  bucket: string;
  key: string;
  path: string;
  contentType?: string;
  fetchImpl?: typeof fetch;
}) => {
  let response = await (d.fetchImpl ?? fetch)(objectStreamUrl(d), {
    method: 'PUT',
    body: await openAsBlob(d.path),
    headers: d.contentType ? { 'content-type': d.contentType } : undefined
  });

  if (!response.ok) {
    let message = await response.text().catch(() => response.statusText);
    throw new ObjectStorageError(response.status, message);
  }
};

export let readObjectStream = async (d: {
  baseUrl: string;
  bucket: string;
  key: string;
  fetchImpl?: typeof fetch;
}) => {
  let response = await (d.fetchImpl ?? fetch)(objectStreamUrl(d));

  if (!response.ok || !response.body) {
    let message = await response.text().catch(() => response.statusText);
    throw new ObjectStorageError(response.status, message);
  }

  let contentLength = response.headers.get('content-length');
  let size = contentLength === null ? Number.NaN : Number(contentLength);

  return {
    stream: response.body,
    contentType: response.headers.get('content-type') ?? undefined,
    size: Number.isFinite(size) ? size : undefined
  };
};
