import { openAsBlob } from 'node:fs';
import { ObjectStorageError, type ZipJob } from 'object-storage-client';

export let objectStreamUrl = (d: { baseUrl: string; bucket: string; key: string }) =>
  `${d.baseUrl.replace(/\/$/, '')}/buckets/${d.bucket}/objects/${d.key}`;

let toObjectStorageError = async (response: Response) => {
  let message = await response.text().catch(() => response.statusText);
  let code: string | undefined;
  try {
    let parsed = JSON.parse(message);
    if (typeof parsed?.code == 'string') code = parsed.code;
  } catch {}
  let retryAfter = parseInt(response.headers.get('retry-after') ?? '', 10);

  return new ObjectStorageError(
    response.status,
    message,
    code,
    Number.isNaN(retryAfter) ? undefined : retryAfter
  );
};

// Same request as the client's createZipJob, with the spec JSON sent from a file.
export let createZipJobFromFile = async (d: {
  baseUrl: string;
  jobId: string;
  path: string;
  waitSeconds?: number;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<ZipJob> => {
  let url = new URL(`${d.baseUrl.replace(/\/$/, '')}/zip-jobs/${encodeURIComponent(d.jobId)}`);
  if (d.waitSeconds !== undefined) url.searchParams.set('wait', String(d.waitSeconds));

  let response = await (d.fetchImpl ?? fetch)(url, {
    method: 'PUT',
    body: await openAsBlob(d.path),
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(Math.max(d.timeoutMs, (d.waitSeconds ?? 0) * 1000 + 10_000))
  });

  if (!response.ok) throw await toObjectStorageError(response);
  return (await response.json()) as ZipJob;
};

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
