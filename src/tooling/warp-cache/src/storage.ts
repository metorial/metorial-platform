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
  exists(key: string): Promise<boolean>;
  metadata(key: string): Promise<ArtifactMetadata | null>;
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

  async metadata(key: string): Promise<ArtifactMetadata | null> {
    return this.entries.get(key)?.metadata || null;
  }

  async exists(key: string): Promise<boolean> {
    return this.entries.has(key);
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
    let metadata = await this.metadata(key);
    if (!metadata) return null;
    return { body: artifact.stream(), metadata };
  }

  async metadata(key: string): Promise<ArtifactMetadata | null> {
    let metadata = Bun.file(this.metadataPath(key));
    if (!(await metadata.exists())) return null;
    return (await metadata.json()) as ArtifactMetadata;
  }

  async exists(key: string): Promise<boolean> {
    return Bun.file(this.artifactPath(key)).exists();
  }

  async put(key: string, body: ReadableStream, metadata: ArtifactMetadata): Promise<void> {
    await mkdir(dirname(this.artifactPath(key)), { recursive: true });
    await Bun.write(this.metadataPath(key), JSON.stringify(metadata));
    await Bun.write(this.artifactPath(key), await new Response(body).arrayBuffer());
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
    let metadata = await this.metadata(key);
    if (!metadata) return null;
    return { body: artifact.stream(), metadata };
  }

  async metadata(key: string): Promise<ArtifactMetadata | null> {
    let metadata = this.client.file(`${key}.json`);
    if (!(await metadata.exists())) return null;
    return (await metadata.json()) as ArtifactMetadata;
  }

  async exists(key: string): Promise<boolean> {
    return this.client.file(`${key}.artifact`).exists();
  }

  async put(key: string, body: ReadableStream, metadata: ArtifactMetadata): Promise<void> {
    await this.client.file(`${key}.json`).write(JSON.stringify(metadata));
    await this.client.file(`${key}.artifact`).write(await new Response(body).arrayBuffer());
  }
}
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
