export class ObjectStorageError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    /** Machine-readable reason, e.g. `spec_conflict`, when the server sent one. */
    public code?: string,
    /** Seconds the server asked the caller to wait before retrying (`Retry-After`). */
    public retryAfterSeconds?: number
  ) {
    super(`Object storage error (status ${statusCode}): ${message}`);
    this.name = 'ObjectStorageError';
  }
}

export class ZipJobTimeoutError extends Error {
  constructor(
    public jobId: string,
    /** The last state seen before giving up, if any request succeeded. */
    public lastJob?: ZipJob
  ) {
    super(`Zip job ${jobId} did not finish in time`);
    this.name = 'ZipJobTimeoutError';
  }
}

export interface Bucket {
  id: string;
  name: string;
  created_at: string;
}

export interface ObjectMetadata {
  key: string;
  size: number;
  content_type?: string;
  etag: string;
  last_modified: string;
  metadata: Record<string, string>;
}

/**
 * Digests of an object's content, computed by the object store while it streams the bytes.
 * `git_blob_sha1` is the id git gives the content as a blob. It needs the length before the
 * first byte, so an upload sent without a Content-Length leaves it null; `getObjectDigests`
 * always computes it.
 */
export interface ContentDigests {
  size: number;
  sha256: string;
  crc32: number;
  git_blob_sha1: string | null;
}

export interface DigestedObjectMetadata extends ObjectMetadata {
  digests: ContentDigests;
}

export interface ObjectData {
  metadata: ObjectMetadata;
  data: Buffer;
}

export type ByteRange =
  | { start: number; end?: number }
  | { suffix: number };

export interface ObjectStream {
  metadata: ObjectMetadata;
  stream: ReadableStream<Uint8Array>;
}

/**
 * A `ReadableStream` or a file-backed `Blob` (`fs.openAsBlob`, `Bun.file`) is sent as it is read,
 * so the object never has to fit in memory.
 */
export type ObjectBody = Buffer | Uint8Array | ArrayBuffer | Blob | ReadableStream<Uint8Array> | string;

export interface ObjectRangeData {
  metadata: ObjectMetadata;
  data: Buffer;
  range: { start: number; end: number; total: number };
}

interface CreateBucketRequest {
  name: string;
}

interface ListBucketsResponse {
  buckets: Bucket[];
}

interface ListObjectsResponse {
  objects: ObjectMetadata[];
  next_continuation_token?: string | null;
}

export interface ObjectPage {
  objects: ObjectMetadata[];
  nextContinuationToken?: string;
}

export interface DeleteObjectResult {
  key: string;
  deleted: boolean;
  error?: string | null;
}

interface DeleteObjectsResponse {
  results: DeleteObjectResult[];
  deleted: number;
  failed: number;
}

export enum PublicUrlPurpose {
  Retrieve = 'retrieve',
  Upload = 'upload',
}

export interface PublicURLResponse {
  url: string;
  /** Headers the caller must send with the request for the signed URL to be accepted. */
  headers: Record<string, string>;
  expires_in: number;
}

export type ZipCompression = 'auto' | 'store' | 'deflate';

export interface ZipEntrySpec {
  /** Path inside the archive. Unsafe or colliding paths are renamed, see `renamedEntries`. */
  path: string;
  source: { bucket: string; key: string };
  compression?: ZipCompression;
  /** Expected source size; the job fails with `source_changed` if the object differs. */
  size?: number;
  /** Expected CRC-32 of the source; the job fails with `crc_mismatch` if the data differs. */
  crc32?: number;
}

export interface ZipJobSpec {
  destination: { bucket: string; key: string; contentType?: string };
  entries: ZipEntrySpec[];
  deflateLevel?: number;
  maxArchiveBytes?: number;
}

export type ZipJobState = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export type ZipErrorCode =
  | 'invalid_spec'
  | 'source_not_found'
  | 'source_changed'
  | 'crc_mismatch'
  | 'invalid_path'
  | 'duplicate_path'
  | 'too_large'
  | 'backend_error'
  | 'lease_expired'
  | 'interrupted'
  | 'internal'
  | 'canceled';

export interface ZipJobProgress {
  entriesTotal: number;
  entriesDone: number;
  bytesRead: number;
  bytesWritten: number;
  bytesEstimate: number;
}

export interface ZipArchiveResult {
  size: number;
  sha256: string;
  etag: string;
  renamedEntries: { path: string; archivePath: string }[];
}

export interface ZipJobError {
  code: ZipErrorCode;
  message: string;
  /** Whether submitting the same spec again may succeed. */
  retryable: boolean;
}

export interface ZipJob {
  id: string;
  state: ZipJobState;
  attempt: number;
  specHash: string;
  owner: string;
  progress: ZipJobProgress;
  result: ZipArchiveResult | null;
  error: ZipJobError | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ObjectStorageClientOptions {
  fetch?: typeof fetch;
}

export interface ZipJobRequestOptions {
  /** Hold the request open until the job ends, for at most this long (the server may clamp it). */
  waitSeconds?: number;
}

export interface WaitForZipJobOptions {
  /** Overall limit, including retries. Defaults to 10 minutes. */
  timeoutMs?: number;
  /** Long-poll length of each request. Defaults to 20 seconds. */
  waitSeconds?: number;
  /** Attempts to run before giving up on retryable failures. Defaults to 3. */
  maxAttempts?: number;
  onProgress?: (job: ZipJob) => void;
}

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

const isActive = (job: ZipJob): boolean =>
  job.state === 'queued' || job.state === 'running';

const transientStatuses = new Set([429, 502, 503, 504]);

const metaHeaderPrefix = 'x-object-meta-';

/** Failures that happened before the server answered: refused connections, resets and timeouts. */
const isTransportError = (error: unknown): boolean => {
  if (error instanceof TypeError) return true;
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
};

/** How long to wait before retrying a request that failed without reaching a job, if at all. */
const transientDelay = (error: unknown, failures: number): number | undefined => {
  if (error instanceof ObjectStorageError) {
    if (!transientStatuses.has(error.statusCode)) return undefined;
    if (error.retryAfterSeconds !== undefined) return error.retryAfterSeconds * 1000;
  } else if (!isTransportError(error)) {
    return undefined;
  }
  return Math.min(500 * 2 ** failures, 5000);
};

const toObjectStorageError = async (response: Response): Promise<ObjectStorageError> => {
  const message = await response.text().catch(() => response.statusText);
  let code: string | undefined;
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed?.code === 'string') code = parsed.code;
  } catch {}
  const retryAfter = parseInt(response.headers.get('retry-after') ?? '', 10);

  return new ObjectStorageError(
    response.status,
    message,
    code,
    Number.isNaN(retryAfter) ? undefined : retryAfter
  );
};

const objectMetadataFromHeaders = (key: string, headers: Headers, size: number): ObjectMetadata => {
  const metadata: Record<string, string> = {};
  headers.forEach((value, name) => {
    if (name.startsWith(metaHeaderPrefix)) metadata[name.substring(metaHeaderPrefix.length)] = value;
  });

  return {
    key,
    size,
    content_type: headers.get('content-type') ?? undefined,
    etag: headers.get('etag') ?? '',
    last_modified: headers.get('last-modified') ?? '',
    metadata,
  };
};

const contentLength = (headers: Headers): number =>
  parseInt(headers.get('content-length') ?? '0', 10) || 0;

type Query = Record<string, string | number | undefined>;
type RequestBody = NonNullable<RequestInit['body']>;

interface RequestOptions {
  query?: Query;
  headers?: Record<string, string>;
  body?: RequestBody;
  json?: unknown;
  timeoutMs?: number;
}

export class ObjectStorageClient {
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;

  /**
   * `timeout` bounds each request until the response is complete; for `getObjectStream` it ends
   * once the headers have arrived, and reading the stream is up to the caller.
   */
  constructor(
    baseURL: string,
    private readonly timeout: number = 30000,
    options: ObjectStorageClientOptions = {}
  ) {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
  }

  private url(path: string, query?: Query): string {
    const url = `${this.baseURL}${path}`;
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.set(name, String(value));
    }
    const search = params.toString();
    return search ? `${url}?${search}` : url;
  }

  /**
   * Resolves once the response headers are in, with `done` to call when the body has been read.
   * The timeout keeps running until then, so a stalled body read fails like a stalled request.
   */
  private async send(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<{ response: Response; done: () => void }> {
    const timeoutMs = options.timeoutMs ?? this.timeout;
    const controller = new AbortController();
    const timer =
      timeoutMs > 0
        ? setTimeout(
            () =>
              controller.abort(
                new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError')
              ),
            timeoutMs
          )
        : undefined;
    const done = () => clearTimeout(timer);

    const headers: Record<string, string> = { ...options.headers };
    let body = options.body;
    if (options.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.json);
    }

    try {
      const response = await this.fetchImpl(this.url(path, options.query), {
        method,
        headers,
        body,
        signal: controller.signal,
        ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
      } as RequestInit);

      if (!response.ok) throw await toObjectStorageError(response);
      return { response, done };
    } catch (error) {
      done();
      throw error;
    }
  }

  private async request(method: string, path: string, options?: RequestOptions): Promise<Response> {
    const { response, done } = await this.send(method, path, options);
    try {
      await response.body?.cancel();
    } finally {
      done();
    }
    return response;
  }

  private async requestJson<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const { response, done } = await this.send(method, path, options);
    try {
      return (await response.json()) as T;
    } finally {
      done();
    }
  }

  private async requestBytes(
    method: string,
    path: string,
    options?: RequestOptions
  ): Promise<{ response: Response; data: Buffer }> {
    const { response, done } = await this.send(method, path, options);
    try {
      return { response, data: Buffer.from(await response.arrayBuffer()) };
    } finally {
      done();
    }
  }

  private waitTimeout(waitSeconds?: number): number | undefined {
    if (!waitSeconds || !this.timeout) return undefined;
    return Math.max(this.timeout, waitSeconds * 1000 + 10000);
  }

  async ping(): Promise<void> {
    await this.request('GET', '/ping');
  }

  async createBucket(name: string): Promise<Bucket> {
    return await this.requestJson<Bucket>('POST', '/buckets', {
      json: { name } as CreateBucketRequest,
    });
  }

  async upsertBucket(name: string): Promise<Bucket> {
    return await this.requestJson<Bucket>('PUT', '/buckets', {
      json: { name } as CreateBucketRequest,
    });
  }

  async getBucket(id: string): Promise<Bucket> {
    return await this.requestJson<Bucket>('GET', `/buckets/${id}`);
  }

  async listBuckets(): Promise<Bucket[]> {
    const response = await this.requestJson<ListBucketsResponse>('GET', '/buckets');
    return response.buckets;
  }

  async deleteBucket(name: string): Promise<void> {
    await this.request('DELETE', `/buckets/${name}`);
  }

  /**
   * Bodies of a known length (bytes, strings, Blobs) are sent with a Content-Length, which lets
   * the server compute `digests.git_blob_sha1` in the same pass. A `ReadableStream` has no length,
   * so its upload leaves that digest null.
   */
  async putObject(
    bucket: string,
    key: string,
    data: ObjectBody,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<DigestedObjectMetadata> {
    const headers: Record<string, string> = {};

    if (contentType) {
      headers['content-type'] = contentType;
    }

    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        headers[`${metaHeaderPrefix}${k}`] = v;
      }
    }

    // Encoded here so the runtime can't attach a text/plain content type of its own.
    const body = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    return await this.requestJson<DigestedObjectMetadata>(
      'PUT',
      `/buckets/${bucket}/objects/${key}`,
      { headers, body: body as RequestBody }
    );
  }

  async getObject(bucket: string, key: string): Promise<ObjectData> {
    const { response, data } = await this.requestBytes('GET', `/buckets/${bucket}/objects/${key}`);

    return {
      metadata: objectMetadataFromHeaders(key, response.headers, contentLength(response.headers)),
      data,
    };
  }

  /** Reads an object as a stream, without buffering it. */
  async getObjectStream(bucket: string, key: string): Promise<ObjectStream> {
    const { response, done } = await this.send('GET', `/buckets/${bucket}/objects/${key}`);
    done();

    return {
      metadata: objectMetadataFromHeaders(key, response.headers, contentLength(response.headers)),
      stream: response.body ?? new ReadableStream<Uint8Array>({ start: c => c.close() }),
    };
  }

  /**
   * Reads only part of an object. `end` is inclusive; `{ suffix: n }` reads the last n bytes.
   * Throws an `ObjectStorageError` with status 416 when the range is outside the object, and with
   * status 200 if the server answered with the whole object because it does not support ranges.
   */
  async getObjectRange(
    bucket: string,
    key: string,
    range: ByteRange
  ): Promise<ObjectRangeData> {
    const header =
      'suffix' in range
        ? `bytes=-${range.suffix}`
        : `bytes=${range.start}-${range.end ?? ''}`;

    const { response, done } = await this.send('GET', `/buckets/${bucket}/objects/${key}`, {
      headers: { Range: header },
    });

    try {
      const contentRange = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
        response.headers.get('content-range') ?? ''
      );

      if (response.status !== 206 || !contentRange) {
        await response.body?.cancel();
        throw new ObjectStorageError(
          response.status,
          'Server did not honour the range request'
        );
      }

      const data = Buffer.from(await response.arrayBuffer());

      const start = parseInt(contentRange[1]!, 10);
      const end = parseInt(contentRange[2]!, 10);
      const total = parseInt(contentRange[3]!, 10);

      return {
        metadata: objectMetadataFromHeaders(key, response.headers, total),
        data,
        range: { start, end, total },
      };
    } finally {
      done();
    }
  }

  async headObject(bucket: string, key: string): Promise<ObjectMetadata> {
    const response = await this.request('HEAD', `/buckets/${bucket}/objects/${key}`);
    return objectMetadataFromHeaders(key, response.headers, contentLength(response.headers));
  }

  async getObjectInfo(bucket: string, key: string): Promise<ObjectMetadata> {
    return await this.requestJson<ObjectMetadata>('GET', `/buckets/${bucket}/object-info/${key}`);
  }

  /** Hashes a stored object on the server, streaming it without holding it in memory. */
  async getObjectDigests(bucket: string, key: string): Promise<DigestedObjectMetadata> {
    return await this.requestJson<DigestedObjectMetadata>(
      'GET',
      `/buckets/${bucket}/object-digests/${key}`
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.request('DELETE', `/buckets/${bucket}/objects/${key}`);
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<DeleteObjectResult[]> {
    if (keys.length === 0) return [];

    const response = await this.requestJson<DeleteObjectsResponse>(
      'POST',
      `/buckets/${bucket}/objects/delete`,
      { json: { keys } }
    );
    return response.results;
  }

  async copyObject(
    bucket: string,
    key: string,
    sourceBucket: string,
    sourceKey: string
  ): Promise<ObjectMetadata> {
    return await this.requestJson<ObjectMetadata>('POST', `/buckets/${bucket}/copy-object/${key}`, {
      json: { source_bucket: sourceBucket, source_key: sourceKey },
    });
  }

  async listObjectsPage(
    bucket: string,
    prefix?: string,
    maxKeys?: number,
    continuationToken?: string
  ): Promise<ObjectPage> {
    const response = await this.requestJson<ListObjectsResponse>(
      'GET',
      `/buckets/${bucket}/objects`,
      {
        query: {
          prefix,
          max_keys: maxKeys,
          continuation_token: continuationToken,
        },
      }
    );

    return {
      objects: response.objects,
      nextContinuationToken: response.next_continuation_token ?? undefined,
    };
  }

  async listObjects(
    bucket: string,
    prefix?: string,
    maxKeys?: number
  ): Promise<ObjectMetadata[]> {
    let objects: ObjectMetadata[] = [];
    let continuationToken: string | undefined;

    for (;;) {
      const page = await this.listObjectsPage(bucket, prefix, maxKeys, continuationToken);
      objects = objects.concat(page.objects);

      if (maxKeys !== undefined && objects.length >= maxKeys) {
        return objects.slice(0, maxKeys);
      }

      if (!page.nextContinuationToken) return objects;

      continuationToken = page.nextContinuationToken;
    }
  }

  async getPublicURL(
    bucket: string,
    key: string,
    expirationSecs?: number,
    purpose?: PublicUrlPurpose
  ): Promise<PublicURLResponse> {
    const response = await this.requestJson<PublicURLResponse>(
      'GET',
      `/buckets/${bucket}/public-url/${key}`,
      { query: { expiration_secs: expirationSecs, purpose } }
    );
    return { ...response, headers: response.headers ?? {} };
  }

  /**
   * Starts building a ZIP archive, or joins the job if `jobId` already exists with the same spec.
   * Re-submitting after a failure or cancel starts a new attempt; a different spec is a 409.
   * Resolves with the job, which is still `queued` or `running` if it did not end within the wait.
   * A large spec can be passed as a `Blob` of its JSON, e.g. a file from `fs.openAsBlob`, so it is
   * sent from disk instead of being serialized in memory.
   */
  async createZipJob(
    jobId: string,
    spec: ZipJobSpec | Blob,
    options: ZipJobRequestOptions = {}
  ): Promise<ZipJob> {
    return await this.requestJson<ZipJob>('PUT', `/zip-jobs/${encodeURIComponent(jobId)}`, {
      query: { wait: options.waitSeconds },
      timeoutMs: this.waitTimeout(options.waitSeconds),
      ...(spec instanceof Blob
        ? { body: spec, headers: { 'content-type': 'application/json' } }
        : { json: spec }),
    });
  }

  async getZipJob(jobId: string, options: ZipJobRequestOptions = {}): Promise<ZipJob> {
    return await this.requestJson<ZipJob>('GET', `/zip-jobs/${encodeURIComponent(jobId)}`, {
      query: { wait: options.waitSeconds },
      timeoutMs: this.waitTimeout(options.waitSeconds),
    });
  }

  /** Cancels the job if it is still active. Resolves with the job as it ended. */
  async cancelZipJob(jobId: string): Promise<ZipJob> {
    return await this.requestJson<ZipJob>('DELETE', `/zip-jobs/${encodeURIComponent(jobId)}`);
  }

  /**
   * Submits the job and waits for it to end, re-submitting after retryable failures (up to
   * `maxAttempts` attempts) and retrying requests that fail on the way (connection errors, 429,
   * 502-504). Resolves with the ended job: `completed`, `canceled`, or `failed` with a
   * non-retryable error or after the last attempt. Throws a `ZipJobTimeoutError` once
   * `timeoutMs` has passed, and an `ObjectStorageError` if the request is refused (e.g. 400, 409).
   */
  async waitForZipJob(
    jobId: string,
    spec: ZipJobSpec | Blob,
    options: WaitForZipJobOptions = {}
  ): Promise<ZipJob> {
    const deadline = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
    const waitSeconds = options.waitSeconds ?? 20;
    const maxAttempts = options.maxAttempts ?? 3;

    let submit = true;
    let failedAttempts = 0;
    let requestFailures = 0;
    let lastJob: ZipJob | undefined;

    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ZipJobTimeoutError(jobId, lastJob);

      const wait = Math.min(waitSeconds, remaining / 1000);
      const started = Date.now();

      let job: ZipJob;
      try {
        job = submit
          ? await this.createZipJob(jobId, spec, { waitSeconds: wait })
          : await this.getZipJob(jobId, { waitSeconds: wait });
      } catch (error) {
        if (!submit && error instanceof ObjectStorageError && error.statusCode === 404) {
          submit = true;
          continue;
        }

        const delay = transientDelay(error, requestFailures++);
        if (delay === undefined) throw error;

        await sleep(Math.min(delay, deadline - Date.now()));
        continue;
      }

      requestFailures = 0;
      submit = false;
      lastJob = job;
      options.onProgress?.(job);

      if (isActive(job)) {
        // A server that answers before the wait is over must not turn this into a busy loop.
        await sleep(Math.min(started + 1000 - Date.now(), deadline - Date.now()));
        continue;
      }
      if (job.state !== 'failed' || !job.error?.retryable) return job;

      failedAttempts++;
      if (failedAttempts >= maxAttempts) return job;

      await sleep(Math.min(1000 * 2 ** (failedAttempts - 1), 30000, deadline - Date.now()));
      submit = true;
    }
  }
}
