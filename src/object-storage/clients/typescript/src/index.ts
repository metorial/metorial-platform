import axios, { AxiosError, AxiosInstance } from 'axios';

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

const headerString = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

const isActive = (job: ZipJob): boolean =>
  job.state === 'queued' || job.state === 'running';

const transientStatuses = new Set([429, 502, 503, 504]);

/** How long to wait before retrying a request that failed without reaching a job, if at all. */
const transientDelay = (error: unknown, failures: number): number | undefined => {
  if (error instanceof ObjectStorageError) {
    if (!transientStatuses.has(error.statusCode)) return undefined;
    if (error.retryAfterSeconds !== undefined) return error.retryAfterSeconds * 1000;
  } else if (!axios.isAxiosError(error) || error.response) {
    return undefined;
  }
  return Math.min(500 * 2 ** failures, 5000);
};

export class ObjectStorageClient {
  private client: AxiosInstance;

  constructor(baseURL: string, timeout: number = 30000) {
    this.client = axios.create({
      baseURL,
      timeout,
    });
  }

  private handleError(error: AxiosError): never {
    if (error.response) {
      const data = error.response.data;
      const message = typeof data === 'string'
        ? data
        : Buffer.isBuffer(data) || data instanceof ArrayBuffer
          ? Buffer.from(data as ArrayBuffer).toString('utf8')
          : JSON.stringify(data);
      const code =
        data && typeof data === 'object' && typeof (data as any).code === 'string'
          ? ((data as any).code as string)
          : undefined;
      const retryAfter = parseInt(String(error.response.headers?.['retry-after'] ?? ''), 10);
      throw new ObjectStorageError(
        error.response.status,
        message,
        code,
        Number.isNaN(retryAfter) ? undefined : retryAfter
      );
    }
    throw error;
  }

  private waitTimeout(waitSeconds?: number): number | undefined {
    const timeout = this.client.defaults.timeout;
    if (!waitSeconds || !timeout) return undefined;
    return Math.max(timeout, waitSeconds * 1000 + 10000);
  }

  async ping(): Promise<void> {
    try {
      await this.client.get('/ping');
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async createBucket(name: string): Promise<Bucket> {
    try {
      const response = await this.client.post<Bucket>('/buckets', {
        name,
      } as CreateBucketRequest);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async upsertBucket(name: string): Promise<Bucket> {
    try {
      const response = await this.client.put<Bucket>('/buckets', {
        name,
      } as CreateBucketRequest);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async getBucket(id: string): Promise<Bucket> {
    try {
      const response = await this.client.get<Bucket>(`/buckets/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async listBuckets(): Promise<Bucket[]> {
    try {
      const response = await this.client.get<ListBucketsResponse>('/buckets');
      return response.data.buckets;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async deleteBucket(name: string): Promise<void> {
    try {
      await this.client.delete(`/buckets/${name}`);
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async putObject(
    bucket: string,
    key: string,
    data: Buffer | Uint8Array | Blob | ReadableStream | string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<DigestedObjectMetadata> {
    try {
      const headers: Record<string, string> = {};

      if (contentType) {
        headers['content-type'] = contentType;
      }

      if (metadata) {
        for (const [k, v] of Object.entries(metadata)) {
          headers[`x-object-meta-${k}`] = v;
        }
      }

      const response = await this.client.put<DigestedObjectMetadata>(
        `/buckets/${bucket}/objects/${key}`,
        data,
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async getObject(bucket: string, key: string): Promise<ObjectData> {
    try {
      const response = await this.client.get<Buffer>(
        `/buckets/${bucket}/objects/${key}`,
        { responseType: 'arraybuffer' }
      );

      const size = parseInt(String(response.headers['content-length'] || '0'), 10);
      const contentType = headerString(response.headers['content-type']);
      const etag = response.headers['etag'] || '';
      const lastModified = response.headers['last-modified'] || '';

      // Extract custom metadata from x-object-meta-* headers
      const metadata: Record<string, string> = {};
      for (const [headerName, headerValue] of Object.entries(response.headers)) {
        if (headerName.startsWith('x-object-meta-')) {
          const metaKey = headerName.substring('x-object-meta-'.length);
          metadata[metaKey] = String(headerValue);
        }
      }

      return {
        metadata: {
          key,
          size,
          content_type: contentType,
          etag,
          last_modified: lastModified,
          metadata,
        },
        data: Buffer.from(response.data),
      };
    } catch (error) {
      this.handleError(error as AxiosError);
    }
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

    try {
      const response = await this.client.get<Buffer>(`/buckets/${bucket}/objects/${key}`, {
        responseType: 'arraybuffer',
        headers: { Range: header },
      });

      const contentRange = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
        String(response.headers['content-range'] || '')
      );

      if (response.status !== 206 || !contentRange) {
        throw new ObjectStorageError(
          response.status,
          'Server did not honour the range request'
        );
      }

      const start = parseInt(contentRange[1]!, 10);
      const end = parseInt(contentRange[2]!, 10);
      const total = parseInt(contentRange[3]!, 10);

      const metadata: Record<string, string> = {};
      for (const [headerName, headerValue] of Object.entries(response.headers)) {
        if (headerName.startsWith('x-object-meta-')) {
          metadata[headerName.substring('x-object-meta-'.length)] = String(headerValue);
        }
      }

      return {
        metadata: {
          key,
          size: total,
          content_type: headerString(response.headers['content-type']),
          etag: response.headers['etag'] || '',
          last_modified: response.headers['last-modified'] || '',
          metadata,
        },
        data: Buffer.from(response.data),
        range: { start, end, total },
      };
    } catch (error) {
      if (error instanceof ObjectStorageError) throw error;
      this.handleError(error as AxiosError);
    }
  }

  async headObject(bucket: string, key: string): Promise<ObjectMetadata> {
    try {
      const response = await this.client.head(`/buckets/${bucket}/objects/${key}`);

      const size = parseInt(String(response.headers['content-length'] || '0'), 10);
      const contentType = headerString(response.headers['content-type']);
      const etag = response.headers['etag'] || '';
      const lastModified = response.headers['last-modified'] || '';

      // Extract custom metadata from x-object-meta-* headers
      const metadata: Record<string, string> = {};
      for (const [headerName, headerValue] of Object.entries(response.headers)) {
        if (headerName.startsWith('x-object-meta-')) {
          const metaKey = headerName.substring('x-object-meta-'.length);
          metadata[metaKey] = String(headerValue);
        }
      }

      return {
        key,
        size,
        content_type: contentType,
        etag,
        last_modified: lastModified,
        metadata,
      };
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async getObjectInfo(bucket: string, key: string): Promise<ObjectMetadata> {
    try {
      const response = await this.client.get<ObjectMetadata>(
        `/buckets/${bucket}/object-info/${key}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /** Hashes a stored object on the server, streaming it without holding it in memory. */
  async getObjectDigests(bucket: string, key: string): Promise<DigestedObjectMetadata> {
    try {
      const response = await this.client.get<DigestedObjectMetadata>(
        `/buckets/${bucket}/object-digests/${key}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      await this.client.delete(`/buckets/${bucket}/objects/${key}`);
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<DeleteObjectResult[]> {
    if (keys.length === 0) return [];

    try {
      const response = await this.client.post<DeleteObjectsResponse>(
        `/buckets/${bucket}/objects/delete`,
        { keys }
      );
      return response.data.results;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async copyObject(
    bucket: string,
    key: string,
    sourceBucket: string,
    sourceKey: string
  ): Promise<ObjectMetadata> {
    try {
      const response = await this.client.post<ObjectMetadata>(
        `/buckets/${bucket}/copy-object/${key}`,
        { source_bucket: sourceBucket, source_key: sourceKey }
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async listObjectsPage(
    bucket: string,
    prefix?: string,
    maxKeys?: number,
    continuationToken?: string
  ): Promise<ObjectPage> {
    try {
      const params: Record<string, string | number> = {};

      if (prefix !== undefined) {
        params.prefix = prefix;
      }
      if (maxKeys !== undefined) {
        params.max_keys = maxKeys;
      }
      if (continuationToken !== undefined) {
        params.continuation_token = continuationToken;
      }

      const response = await this.client.get<ListObjectsResponse>(
        `/buckets/${bucket}/objects`,
        { params }
      );

      return {
        objects: response.data.objects,
        nextContinuationToken: response.data.next_continuation_token ?? undefined,
      };
    } catch (error) {
      this.handleError(error as AxiosError);
    }
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
    try {
      const params: Record<string, number | string> = {};

      if (expirationSecs !== undefined) {
        params.expiration_secs = expirationSecs;
      }

      if (purpose !== undefined) {
        params.purpose = purpose;
      }

      const response = await this.client.get<PublicURLResponse>(
        `/buckets/${bucket}/public-url/${key}`,
        { params }
      );
      return { ...response.data, headers: response.data.headers ?? {} };
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Starts building a ZIP archive, or joins the job if `jobId` already exists with the same spec.
   * Re-submitting after a failure or cancel starts a new attempt; a different spec is a 409.
   * Resolves with the job, which is still `queued` or `running` if it did not end within the wait.
   */
  async createZipJob(
    jobId: string,
    spec: ZipJobSpec,
    options: ZipJobRequestOptions = {}
  ): Promise<ZipJob> {
    try {
      const params: Record<string, number> = {};

      if (options.waitSeconds !== undefined) {
        params.wait = options.waitSeconds;
      }

      const response = await this.client.put<ZipJob>(
        `/zip-jobs/${encodeURIComponent(jobId)}`,
        spec,
        { params, timeout: this.waitTimeout(options.waitSeconds) }
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async getZipJob(jobId: string, options: ZipJobRequestOptions = {}): Promise<ZipJob> {
    try {
      const params: Record<string, number> = {};

      if (options.waitSeconds !== undefined) {
        params.wait = options.waitSeconds;
      }

      const response = await this.client.get<ZipJob>(
        `/zip-jobs/${encodeURIComponent(jobId)}`,
        { params, timeout: this.waitTimeout(options.waitSeconds) }
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /** Cancels the job if it is still active. Resolves with the job as it ended. */
  async cancelZipJob(jobId: string): Promise<ZipJob> {
    try {
      const response = await this.client.delete<ZipJob>(
        `/zip-jobs/${encodeURIComponent(jobId)}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
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
    spec: ZipJobSpec,
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
