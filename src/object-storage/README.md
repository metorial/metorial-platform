# Object Storage Service

A lightweight, universal object storage service. It provides a simple HTTP API for managing buckets and objects, with support for multiple storage backends including local filesystem, AWS S3, Google Cloud Storage, and Azure Blob Storage.

## Features

- RESTful HTTP API for object storage operations
- Multi-backend support (local, S3, GCS, Azure)
- Support for metadata directly in the storage backend
- ETag generation for cache validation

## Installation

### Using Docker

The Docker image does not include configuration. You must provide it externally using either a config file or environment variables.

**Option 1: Using a configuration file (recommended)**

Copy `config.example.toml` to `config.toml` and modify it for your needs, then mount it into the container:

```bash
docker pull ghcr.io/metorial/object-storage:latest

# Create your config.toml first (see Configuration section below)
docker run -p 8080:8080 \
  -e CONFIG_PATH=/app/config/config.toml \
  -v $(pwd)/config.toml:/app/config/config.toml:ro \
  -v object-store-data:/app/data \
  ghcr.io/metorial/object-storage:latest
```

**Option 2: Using environment variables**

Configure entirely through environment variables without a config file:

```bash
docker run -p 8080:8080 \
  -e OBJECT_STORE__SERVER__HOST=0.0.0.0 \
  -e OBJECT_STORE__SERVER__PORT=8080 \
  -e OBJECT_STORE__BACKEND__TYPE=local \
  -e OBJECT_STORE__BACKEND__ROOT_PATH=/app/data \
  -e OBJECT_STORE__BACKEND__PHYSICAL_BUCKET=object-store-data \
  -v object-store-data:/app/data \
  ghcr.io/metorial/object-storage:latest
```

**Using Docker Compose**

```yaml
services:
  object-storage:
    image: ghcr.io/metorial/object-storage:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config.toml:/app/config/config.toml:ro
      - object-store-data:/app/data
    environment:
      - CONFIG_PATH=/app/config/config.toml
      - RUST_LOG=info

volumes:
  object-store-data:
```

### Building from Source

```bash
cargo build --release
./target/release/object-store-service
```

## Configuration

The service requires configuration to be provided externally. You can use either a TOML file or environment variables.

### Configuration File

Create a `config.toml` file and set the `CONFIG_PATH` environment variable:

```bash
export CONFIG_PATH=/path/to/config.toml
./object-store-service
```

**Example config.toml for local development:**

```toml
[server]
host = "127.0.0.1"
port = 8080

[backend]
type = "local"
root_path = "./data"
physical_bucket = "object-store-data"
```

**Example config.toml for Docker:**

```toml
[server]
host = "0.0.0.0"  # Accept connections from any interface
port = 8080

[backend]
type = "local"
root_path = "/app/data"  # Use container paths
physical_bucket = "object-store-data"
```

### Environment Variables

All config options can be set via environment variables with the `OBJECT_STORE__` prefix. Nested keys use double underscores:

```bash
export OBJECT_STORE__SERVER__HOST=0.0.0.0
export OBJECT_STORE__SERVER__PORT=8080
export OBJECT_STORE__BACKEND__TYPE=local
export OBJECT_STORE__BACKEND__ROOT_PATH=/app/data
export OBJECT_STORE__BACKEND__PHYSICAL_BUCKET=object-store-data
```

Environment variables override config file values, allowing you to use a base config file and override specific settings.

### Backend Configuration

**Local filesystem:**
```toml
[backend]
type = "local"
root_path = "./data"
physical_bucket = "object-store-data"
```

**S3:**
```toml
[backend]
type = "s3"
region = "us-east-1"
physical_bucket = "my-bucket"
endpoint = "http://localhost:9000"  # Optional, for MinIO
```

**Google Cloud Storage:**
```toml
[backend]
type = "gcs"
physical_bucket = "my-gcs-bucket"
```

**Azure Blob Storage:**
```toml
[backend]
type = "azure"
account = "myaccount"
access_key = "myaccesskey"
physical_bucket = "mycontainer"
```

## API Reference

### Health Check

```
GET /health
```

Returns service health status.

### Buckets

**Create a bucket:**
```
POST /buckets
Content-Type: application/json

{
  "name": "my-bucket"
}
```

**List buckets:**
```
GET /buckets
```

**Delete a bucket:**
```
DELETE /buckets/{bucket}
```

### Objects

**Upload an object:**
```
PUT /buckets/{bucket}/objects/{key}
Content-Type: application/octet-stream
x-object-meta-author: john
x-object-meta-version: 1.0

[binary data]
```

Custom metadata headers must be prefixed with `x-object-meta-`.

**Download an object:**
```
GET /buckets/{bucket}/objects/{key}
```

**Download part of an object:** send a single `Range: bytes=start-end`, `bytes=start-` or `bytes=-length`
header. The backend reads only that range (`206 Partial Content` with `Content-Range`); a range outside
the object returns `416` with `Content-Range: bytes */size`. Malformed or multi-range headers, and any
`Range` sent with `If-Range`, are ignored and the whole object is returned. `GET` and `HEAD` responses
carry `Accept-Ranges: bytes`.
```
GET /buckets/{bucket}/objects/{key}
Range: bytes=0-4095
```

**Get object metadata:**
```
HEAD /buckets/{bucket}/objects/{key}
```

**Delete an object:**
```
DELETE /buckets/{bucket}/objects/{key}
```

**Delete many objects:**
```
POST /buckets/{bucket}/objects/delete
Content-Type: application/json

{"keys": ["folder/a.txt", "folder/b.txt"]}
```

Returns one result per requested key, so partial failures stay visible:

```json
{
  "results": [
    { "key": "folder/a.txt", "deleted": true, "error": null },
    { "key": "folder/b.txt", "deleted": false, "error": "..." }
  ],
  "deleted": 1,
  "failed": 1
}
```

Deleting a key that does not exist counts as deleted. Bucket marker keys
(`.bucket`) are rejected.

**Copy an object between logical buckets:**
```
POST /buckets/{bucket}/copy-object/{key}
Content-Type: application/json

{"source_bucket": "files", "source_key": "abc123"}
```

Copies into `{bucket}/{key}` from `source_bucket`/`source_key` and returns the
destination's object metadata. Both logical buckets live in the same physical
bucket, so S3 and GCS perform this server-side and the bytes never pass through
a caller. Other backends fall back to streaming the object through the service.
Bucket marker keys are rejected as destinations.

**List objects in a bucket:**
```
GET /buckets/{bucket}/objects?prefix=folder/&max_keys=100&continuation_token=...
```

Query parameters:
- `prefix` (optional): Filter objects by prefix
- `max_keys` (optional): Maximum number of results in this page
- `continuation_token` (optional): Token from a previous response's `next_continuation_token`

The response carries `next_continuation_token` whenever more objects remain.
Backends impose their own page limits (S3 caps a page at 1000 keys regardless of
`max_keys`), so a listing is only complete once `next_continuation_token` is
absent. The official clients loop over pages for you.

### Response Format

All JSON responses follow this structure:

**Success (Bucket):**
```json
{
  "name": "my-bucket",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Success (Object Metadata):**
```json
{
  "key": "path/to/file.txt",
  "size": 1024,
  "content_type": "text/plain",
  "etag": "abc123...",
  "last_modified": "2024-01-15T10:30:00Z",
  "metadata": {
    "author": "john",
    "version": "1.0"
  }
}
```

**Error:**
```json
{
  "error": "Bucket not found: my-bucket"
}
```

## Architecture

The service is organized into three main components:

- **object-store**: HTTP API layer and service logic
- **object-store-backends**: Storage backend implementations
- **clients**: Client libraries for different languages

## Client Libraries

Client libraries are available for multiple languages:

### Go

```bash
go get github.com/metorial/object-storage/clients/go
```

```go
import objectstorage "github.com/metorial/object-storage/clients/go"

client := objectstorage.NewClient("http://localhost:8080")
bucket, err := client.CreateBucket("my-bucket")
```

See [clients/go/README.md](clients/go/README.md) for full documentation.

### TypeScript/JavaScript

```bash
npm install @metorial/object-storage-client
```

```typescript
import { ObjectStorageClient } from '@metorial/object-storage-client';

const client = new ObjectStorageClient('http://localhost:8080');
const bucket = await client.createBucket('my-bucket');
```

See [clients/typescript/README.md](clients/typescript/README.md) for full documentation.

### Rust

```toml
[dependencies]
object-storage-client = "0.1"
```

See [clients/rust/README.md](clients/rust/README.md) for full documentation.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) file for details.
