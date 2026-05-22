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

interface CreateBucketRequest {
  name: string;
}

interface ListBucketsResponse {
  buckets: Bucket[];
}

interface ListObjectsResponse {
  objects: ObjectMetadata[];
}

export enum PublicUrlPurpose {
  Retrieve = 'retrieve',
  Upload = 'upload',
}

export interface PublicURLResponse {
  url: string;
  expires_in: number;
}

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

      const size = parseInt(response.headers['content-length'] || '0', 10);
      const contentType = response.headers['content-type'];
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

  async headObject(bucket: string, key: string): Promise<ObjectMetadata> {
    try {
      const response = await this.client.head(`/buckets/${bucket}/objects/${key}`);

      const size = parseInt(response.headers['content-length'] || '0', 10);
      const contentType = response.headers['content-type'];
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

  async listObjects(
    bucket: string,
    prefix?: string,
    maxKeys?: number
  ): Promise<ObjectMetadata[]> {
    try {
      const params: Record<string, string | number> = {};

      if (prefix !== undefined) {
        params.prefix = prefix;
      }
      if (maxKeys !== undefined) {
        params.max_keys = maxKeys;
      }

      const response = await this.client.get<ListObjectsResponse>(
        `/buckets/${bucket}/objects`,
        { params }
      );
      return response.data.objects;
    } catch (error) {
      this.handleError(error as AxiosError);
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
