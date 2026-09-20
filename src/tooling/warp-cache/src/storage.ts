export type ArtifactMetadata = {
  size: number;
  duration?: number;
  tag?: string;
};

export type Artifact = {
  body: ReadableStream;
  metadata: ArtifactMetadata;
};

export interface Storage {
  get(key: string): Promise<Artifact | null>;
  put(key: string, body: ReadableStream, metadata: ArtifactMetadata): Promise<void>;
}

export class MemoryStorage implements Storage {
  entries = new Map<string, { body: Uint8Array; metadata: ArtifactMetadata }>();

  async get(key: string): Promise<Artifact | null> {
    let entry = this.entries.get(key);
    if (!entry) return null;
    return {
      body: new Blob([entry.body]).stream(),
      metadata: entry.metadata
    };
  }

  async put(key: string, body: ReadableStream, metadata: ArtifactMetadata): Promise<void> {
    this.entries.set(key, { body: new Uint8Array(await new Response(body).arrayBuffer()), metadata });
  }
}

export class FileStorage implements Storage {
  constructor(private root: string) {}

  artifactPath(key: string) {
    return `${this.root}/${key}.artifact`;
  }

  metadataPath(key: string) {
    return `${this.root}/${key}.json`;
  }

  async get(key: string): Promise<Artifact | null> {
    let artifact = Bun.file(this.artifactPath(key));
    if (!(await artifact.exists())) return null;
    let metadata = (await Bun.file(this.metadataPath(key)).json()) as ArtifactMetadata;
    return { body: artifact.stream(), metadata };
  }

  async put(key: string, body: ReadableStream, metadata: ArtifactMetadata): Promise<void> {
    await mkdir(dirname(this.artifactPath(key)), { recursive: true });
    await Bun.write(this.artifactPath(key), await new Response(body).arrayBuffer());
    await Bun.write(this.metadataPath(key), JSON.stringify(metadata));
  }
}

export class S3Storage implements Storage {
  client: Bun.S3Client;

  constructor(bucket: string, region: string) {
    this.client = new Bun.S3Client({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN,
      bucket,
      region,
      endpoint: `https://s3.${region}.amazonaws.com`
    });
  }

  async get(key: string): Promise<Artifact | null> {
    let artifact = this.client.file(`${key}.artifact`);
    if (!(await artifact.exists())) return null;
    let metadata = (await this.client.file(`${key}.json`).json()) as ArtifactMetadata;
    return { body: artifact.stream(), metadata };
  }

  async put(key: string, body: ReadableStream, metadata: ArtifactMetadata): Promise<void> {
    await this.client.file(`${key}.artifact`).write(await new Response(body).arrayBuffer());
    await this.client.file(`${key}.json`).write(JSON.stringify(metadata));
  }
}
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
