import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import {
  MULTIPART_MIN_PART_SIZE,
  ObjectStorageClient,
  ObjectStorageError
} from '../src/index';
import { startLiveServer } from './liveServer';

describe('durable multipart uploads against a live server', () => {
  let server: Awaited<ReturnType<typeof startLiveServer>>;
  let client: ObjectStorageClient;

  beforeAll(async () => {
    server = await startLiveServer('multipart');
    client = server.client;
    await client.createBucket('exports');
  }, 300_000);

  afterAll(async () => {
    await server?.stop();
  });

  test('uploads parts from separate clients and completes', async () => {
    let first = randomBytes(MULTIPART_MIN_PART_SIZE);
    let second = randomBytes(1234);

    let uploadId = await client.startMultipartUpload(
      'exports',
      'org/a.csv.gz',
      'application/gzip',
      {
        rows: '42'
      }
    );
    expect(await client.listMultipartUploads('exports', 'org/')).toEqual([
      expect.objectContaining({ key: 'org/a.csv.gz', uploadId })
    ]);

    let stale = await client.uploadPart(
      'exports',
      'org/a.csv.gz',
      uploadId,
      1,
      randomBytes(10)
    );
    let one = await client.uploadPart('exports', 'org/a.csv.gz', uploadId, 1, first);
    expect(one.etag).not.toBe(stale.etag);

    let other = new ObjectStorageClient(server.url);
    let two = await other.uploadPart('exports', 'org/a.csv.gz', uploadId, 2, second);

    let object = await other.completeMultipartUpload('exports', 'org/a.csv.gz', uploadId, [
      one,
      two
    ]);
    expect(object.size).toBe(first.length + second.length);
    expect(object.metadata.rows).toBe('42');

    let stored = await client.getObject('exports', 'org/a.csv.gz');
    expect(stored.data.equals(Buffer.concat([first, second]))).toBe(true);
    expect(stored.metadata.content_type).toBe('application/gzip');
    expect(await client.listMultipartUploads('exports', 'org/')).toEqual([]);
  });

  test('rejects completing with a replaced part etag', async () => {
    let uploadId = await client.startMultipartUpload('exports', 'b');
    let stale = await client.uploadPart('exports', 'b', uploadId, 1, Buffer.from('old'));
    await client.uploadPart('exports', 'b', uploadId, 1, Buffer.from('new'));

    let error = await client
      .completeMultipartUpload('exports', 'b', uploadId, [stale])
      .catch(error => error);
    expect(error).toBeInstanceOf(ObjectStorageError);
    expect(error.statusCode).toBe(400);
  });

  test('aborts idempotently', async () => {
    let uploadId = await client.startMultipartUpload('exports', 'c');
    await client.abortMultipartUpload('exports', 'c', uploadId);
    await client.abortMultipartUpload('exports', 'c', uploadId);

    let error = await client
      .uploadPart('exports', 'c', uploadId, 1, Buffer.from('x'))
      .catch(error => error);
    expect(error.statusCode).toBe(404);
  });
});
