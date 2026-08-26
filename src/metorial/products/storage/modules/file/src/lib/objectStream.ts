import { ObjectStorageError } from 'object-storage-client';

export let objectStreamUrl = (d: { baseUrl: string; bucket: string; key: string }) =>
  `${d.baseUrl.replace(/\/$/, '')}/buckets/${d.bucket}/objects/${d.key}`;

/**
 * Reads an object without materialising it. The storage client's getObject()
 * buffers the whole body, which cannot hold for the multi-gigabyte files that
 * uploads accept.
 */
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
