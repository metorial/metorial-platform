# Origin

Origin is a code workspace management platform that provides isolated file storage, browser-based VS Code editing, and SCM integration for GitHub and GitLab repositories.

## Architecture

The platform consists of two main services:

- **origin-service**: Metadata management, multi-tenant support, database operations
- **origin-code-bucket**: File storage, workspace management, VS Code web server, SCM integration

## Features

- **Workspace Management**: Isolated code buckets with multi-tenant support
- **Browser-Based IDE**: Embedded VS Code web interface for in-browser editing
- **SCM Integration**: Import/export from GitHub and GitLab repositories
- **Multi-Protocol Access**: HTTP REST API, gRPC RPC, and VS Code web server
- **Flexible Storage**: Redis cache with S3-compatible object storage backend
- **Token-Based Security**: JWT authentication with configurable expiration and read-only modes
- **File Operations**: Upload, download, list, delete with ZIP export support

## Quick Start

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: origin
      POSTGRES_PASSWORD: origin
      POSTGRES_DB: origin
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - origin-network

  redis:
    image: redis:7-alpine
    networks:
      - origin-network

  object-storage:
    image: ghcr.io/metorial/object-storage:latest
    volumes:
      - object-store-data:/app/data
    environment:
      RUST_LOG: info
      OBJECT_STORE__SERVER__HOST: 0.0.0.0
      OBJECT_STORE__SERVER__PORT: 52010
      OBJECT_STORE__BACKEND__TYPE: local
    networks:
      - origin-network

  origin:
    image: ghcr.io/metorial/origin:latest
    ports:
      - '52050:52050'
    environment:
      DATABASE_URL: postgresql://origin:origin@postgres:5432/origin
      REDIS_URL: redis://redis:6379/0
      OBJECT_STORAGE_URL: http://object-storage:52010
      LOGS_BUCKET_NAME: logs
    depends_on:
      - postgres
      - redis
      - object-storage
    networks:
      - origin-network

  code-bucket:
    image: ghcr.io/metorial/origin-code-bucket:latest
    ports:
      - '52091:52091'  # HTTP API
      - '52092:52092'  # VS Code Workspace
    environment:
      CODE_BUCKET_JWT_SECRET: dev-secret-change-in-production
      CODE_BUCKET_OBJECT_STORAGE_BUCKET: code-bucket
      CODE_BUCKET_OBJECT_STORAGE_ENDPOINT: http://object-storage:52010
      CODE_BUCKET_REDIS_URL: redis://redis:6379
      CODE_BUCKET_HTTP_ADDRESS: ':52091'
      CODE_BUCKET_WORKSPACE_ADDRESS: ':52092'
      CODE_BUCKET_RPC_ADDRESS: ':5050'
    depends_on:
      - redis
      - object-storage
    networks:
      - origin-network

volumes:
  postgres_data:
  object-store-data:

networks:
  origin-network:
    driver: bridge
```

Start the services:

```bash
docker-compose up -d
```

The services will be available at:
- Origin service: `http://localhost:52050`
- Code bucket HTTP API: `http://localhost:52091`
- Code bucket VS Code workspace: `http://localhost:52092`

## gRPC Client

### Installation

```bash
npm install @grpc/grpc-js @bufbuild/protobuf
```

### Basic Usage

```typescript
import { credentials } from '@grpc/grpc-js';
import { CodeBucketClient } from './rpc';

const client = new CodeBucketClient(
  'localhost:5050',
  credentials.createInsecure()
);
```

### Core API Examples

#### 1. Creating Buckets

```typescript
// Create from GitHub repository
await client.createBucketFromGithub({
  newBucketId: 'bucket-123',
  owner: 'metorial',
  repo: 'origin',
  path: 'apps/code-bucket',
  ref: 'main',
  token: 'ghp_...'
});

// Create from GitLab project
await client.createBucketFromGitlab({
  newBucketId: 'bucket-456',
  projectId: Long.fromNumber(12345),
  path: 'src',
  ref: 'main',
  token: 'glpat-...',
  gitlabApiUrl: 'https://gitlab.com/api/v4'
});

// Create from ZIP file
await client.createBucketFromZip({
  newBucketId: 'bucket-789',
  zipUrl: 'https://example.com/archive.zip',
  path: '',
  headers: {
    'Authorization': 'Bearer token'
  }
});

// Create from file contents
await client.createBucketFromContents({
  newBucketId: 'bucket-012',
  contents: [
    {
      path: 'index.ts',
      content: new TextEncoder().encode('console.log("Hello");')
    },
    {
      path: 'package.json',
      content: new TextEncoder().encode('{"name": "app"}')
    }
  ]
});

// Clone existing bucket
await client.cloneBucket({
  sourceBucketId: 'bucket-123',
  newBucketId: 'bucket-clone'
});
```

#### 2. Token Management

```typescript
// Generate bucket access token (1 hour expiration)
const tokenResponse = await client.getBucketToken({
  bucketId: 'bucket-123',
  expiresInSeconds: Long.fromNumber(3600),
  isReadOnly: false
});

console.log('Token:', tokenResponse.token);

// Generate read-only token
const readOnlyToken = await client.getBucketToken({
  bucketId: 'bucket-123',
  expiresInSeconds: Long.fromNumber(1800),
  isReadOnly: true
});
```

#### 3. File Operations

```typescript
// Get single file with content
const fileResponse = await client.getBucketFile({
  bucketId: 'bucket-123',
  path: 'src/index.ts'
});

console.log('Path:', fileResponse.content?.fileInfo?.path);
console.log('Size:', fileResponse.content?.fileInfo?.size.toString());
console.log('Content:', new TextDecoder().decode(fileResponse.content?.content));

// List all files
const filesResponse = await client.getBucketFiles({
  bucketId: 'bucket-123',
  prefix: ''
});

for (const file of filesResponse.files) {
  console.log('File:', file.path);
  console.log('Size:', file.size.toString());
  console.log('Type:', file.contentType);
  console.log('Modified:', new Date(file.modifiedAt.toNumber() * 1000));
}

// List files with prefix filter
const srcFiles = await client.getBucketFiles({
  bucketId: 'bucket-123',
  prefix: 'src/'
});

// Get all files with content
const filesWithContent = await client.getBucketFilesWithContent({
  bucketId: 'bucket-123',
  prefix: 'src/'
});

for (const file of filesWithContent.files) {
  const content = new TextDecoder().decode(file.content);
  console.log(`${file.fileInfo?.path}: ${content.length} chars`);
}

// Export bucket as ZIP
const zipResponse = await client.getBucketFilesAsZip({
  bucketId: 'bucket-123',
  prefix: ''
});

console.log('Download URL:', zipResponse.downloadUrl);
console.log('Expires at:', new Date(zipResponse.expiresAt.toNumber() * 1000));
```

#### 4. SCM Export

```typescript
// Export to GitHub
await client.exportBucketToGithub({
  bucketId: 'bucket-123',
  owner: 'metorial',
  repo: 'origin',
  path: 'apps/code-bucket',
  token: 'ghp_...'
});

// Export to GitLab
await client.exportBucketToGitlab({
  bucketId: 'bucket-123',
  projectId: Long.fromNumber(12345),
  path: 'src',
  token: 'glpat-...',
  gitlabApiUrl: 'https://gitlab.com/api/v4'
});
```

#### 5. HTTP API Usage

```typescript
// Using the HTTP API with a bucket token
const token = 'eyJhbGc...'; // From getBucketToken

// List files
const files = await fetch('http://localhost:52091/files?bucketId=bucket-123', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Get file
const file = await fetch('http://localhost:52091/files/src/index.ts?bucketId=bucket-123', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Upload file
await fetch('http://localhost:52091/files/src/new-file.ts?bucketId=bucket-123', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'text/plain'
  },
  body: 'console.log("new file");'
});

// Delete file
await fetch('http://localhost:52091/files/src/old-file.ts?bucketId=bucket-123', {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

#### 6. VS Code Workspace Access

```typescript
// Open bucket in browser-based VS Code
const workspaceUrl = `http://localhost:52092/?bucketId=bucket-123&token=${token}`;
console.log('Open workspace:', workspaceUrl);
// Navigate user to this URL for in-browser editing
```

## Environment Variables

### origin-service

```bash
DATABASE_URL=postgresql://origin:origin@localhost:5432/origin
REDIS_URL=redis://localhost:6379/0
OBJECT_STORAGE_URL=http://localhost:52010
LOGS_BUCKET_NAME=logs
```

### origin-code-bucket

Required:
```bash
CODE_BUCKET_JWT_SECRET=your-secret-key
CODE_BUCKET_OBJECT_STORAGE_ENDPOINT=http://localhost:52010
CODE_BUCKET_OBJECT_STORAGE_BUCKET=code-bucket
```

Optional:
```bash
CODE_BUCKET_HTTP_ADDRESS=:52091
CODE_BUCKET_RPC_ADDRESS=:5050
CODE_BUCKET_WORKSPACE_ADDRESS=:52092
CODE_BUCKET_REDIS_URL=redis://localhost:6379

# Alternative Redis configuration
REDIS_ENDPOINT=localhost
REDIS_PORT=6379
REDIS_TLS=false
REDIS_DB=0
REDIS_PASSWORD=
```

## Data Models

### FileInfo

```typescript
interface FileInfo {
  path: string;
  size: Long;
  contentType: string;
  modifiedAt: Long;  // Unix timestamp
}
```

### FileContent

```typescript
interface FileContent {
  content: Uint8Array;
  fileInfo: FileInfo;
}
```

## Security

### JWT Token Structure

Tokens are signed using HMAC-256 with the configured secret:

```typescript
{
  "aud": "bucket-123",      // Bucket ID
  "iss": "code-bucket",     // Issuer
  "exp": 1234567890,        // Expiration timestamp
  "read_only": false        // Read-only flag
}
```

### HTTP API Authentication

Tokens can be provided via:
- Header: `Authorization: Bearer <token>`
- Query parameter: `?metorial-code-bucket-token=<token>`

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built by <a href="https://metorial.com">Metorial</a></sub>
</div>
