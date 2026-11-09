# Object Storage Client for TypeScript

TypeScript/JavaScript client library for interacting with the [Metorial Object Storage Service](https://github.com/metorial/object-storage).

## Usage

```typescript
import { ObjectStorageClient } from 'object-storage-client';

const client = new ObjectStorageClient('http://localhost:8080');

// Create a bucket
const bucket = await client.createBucket('my-bucket');
console.log(`Created bucket: ${bucket.name}`);

// Upload an object
const data = Buffer.from('Hello, World!');
const obj = await client.putObject(
  'my-bucket',
  'hello.txt',
  data,
  'text/plain',
  { key1: 'value1' }
);
console.log(`Uploaded object: ${obj.key} (ETag: ${obj.etag})`);

// Download an object
const objData = await client.getObject('my-bucket', 'hello.txt');
console.log(`Downloaded ${objData.data.length} bytes`);

// List objects
const objects = await client.listObjects('my-bucket');
for (const obj of objects) {
  console.log(`${obj.key}: ${obj.size} bytes`);
}

// Delete object
await client.deleteObject('my-bucket', 'hello.txt');

// Delete bucket
await client.deleteBucket('my-bucket');
```

## API Reference

### Client Creation

```typescript
const client = new ObjectStorageClient('http://localhost:8080');
```

With custom timeout:

```typescript
const client = new ObjectStorageClient('http://localhost:8080', 60000);
```

### Bucket Operations

**Create Bucket**
```typescript
const bucket = await client.createBucket('bucket-name');
```

**List Buckets**
```typescript
const buckets = await client.listBuckets();
```

**Delete Bucket**
```typescript
await client.deleteBucket('bucket-name');
```

### Object Operations

**Put Object**
```typescript
const data = Buffer.from('content');
const obj = await client.putObject(
  'bucket-name',
  'object-key',
  data,
  'application/json',
  { key: 'value' }
);
```

**Get Object**
```typescript
const objData = await client.getObject('bucket-name', 'object-key');
// objData.data contains the object buffer
// objData.metadata contains metadata
```

**Get Part of an Object**
```typescript
// The first 4 KiB (end is inclusive), the tail, or everything from an offset
const head = await client.getObjectRange('bucket-name', 'object-key', { start: 0, end: 4095 });
const tail = await client.getObjectRange('bucket-name', 'object-key', { suffix: 1024 });
// head.data is the buffer, head.range is { start, end, total }
// Throws ObjectStorageError with status 416 if the range is outside the object
```

**Head Object**
```typescript
const metadata = await client.headObject('bucket-name', 'object-key');
```

**Delete Object**
```typescript
await client.deleteObject('bucket-name', 'object-key');
```

**Delete Many Objects**
```typescript
const results = await client.deleteObjects('bucket-name', ['a.txt', 'b.txt']);
for (const result of results) {
  if (!result.deleted) console.log(`${result.key} failed: ${result.error}`);
}
```

**Copy Object**
```typescript
// Copies into 'bucket-name/skills/demo/asset.bin' from 'files/abc123'.
// The bytes are copied inside the object store, never through this process.
const metadata = await client.copyObject('bucket-name', 'skills/demo/asset.bin', 'files', 'abc123');
```

**List Objects**
```typescript
// List all objects, following pagination internally
const objects = await client.listObjects('bucket-name');

// List with prefix
const objects = await client.listObjects('bucket-name', 'prefix/');

// Stop after at most 100 objects
const objects = await client.listObjects('bucket-name', 'prefix/', 100);

// Drive pagination yourself
let token: string | undefined;
do {
  const page = await client.listObjectsPage('bucket-name', 'prefix/', 500, token);
  token = page.nextContinuationToken;
} while (token);
```

## Error Handling

The client throws `ObjectStorageError` for API errors:

```typescript
import { ObjectStorageError } from 'object-storage-client';

try {
  const obj = await client.getObject('bucket', 'key');
} catch (error) {
  if (error instanceof ObjectStorageError) {
    console.log(`Status: ${error.statusCode}, Message: ${error.message}`);
  }
}
```
