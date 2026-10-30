import axios, { AxiosError, AxiosInstance } from 'axios';

export class ObjectStorageError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(`Object storage error (status ${statusCode}): ${message}`);
    this.name = 'ObjectStorageError';
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
  expires_in: number;
}

const headerString = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

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
      const message = typeof error.response.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response.data);
      throw new ObjectStorageError(error.response.status, message);
    }
    throw error;
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
  ): Promise<ObjectMetadata> {
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

      const response = await this.client.put<ObjectMetadata>(
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
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }
}
