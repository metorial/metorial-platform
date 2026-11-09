import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { ObjectStorageClient, ObjectStorageError } from '../src/index';
import { startLiveServer } from './liveServer';

const reference = (data: Buffer) => ({
  size: data.length,
  sha256: createHash('sha256').update(data).digest('hex'),
  crc32: Bun.hash.crc32(data),
  git_blob_sha1: createHash('sha1')
    .update(`blob ${data.length}\0`)
    .update(data)
    .digest('hex'),
});

const chunked = (data: Buffer, size: number) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < data.length; offset += size) {
        controller.enqueue(data.subarray(offset, offset + size));
      }
      controller.close();
    },
  });

describe('object digests against a live server', () => {
  let server: Awaited<ReturnType<typeof startLiveServer>>;
  let client: ObjectStorageClient;

  beforeAll(async () => {
    server = await startLiveServer('digests');
    client = server.client;
  }, 300_000);

  afterAll(async () => {
    await server?.stop();
  });

  test('putObject returns every digest of what it stored', async () => {
    const data = randomBytes(3 * 1024 * 1024 + 7);

    const stored = await client.putObject('files', 'sized.bin', data);

    expect(stored.digests).toEqual(reference(data));
    expect(stored.size).toBe(data.length);
  });

  test('a streamed upload leaves the git blob id to getObjectDigests', async () => {
    const data = randomBytes(20 * 1024 * 1024 + 3);

    const uploaded = await client.putObject('files', 'dir/streamed.bin', chunked(data, 1024 * 1024));
    expect(uploaded.digests).toEqual({ ...reference(data), git_blob_sha1: null });

    const digested = await client.getObjectDigests('files', 'dir/streamed.bin');
    expect(digested.digests).toEqual(reference(data));
    expect(digested.key).toBe('dir/streamed.bin');
    expect(digested.size).toBe(data.length);
  });

  test('getObjectDigests of an empty object', async () => {
    await client.putObject('files', 'empty.txt', Buffer.alloc(0));

    const { digests } = await client.getObjectDigests('files', 'empty.txt');

    expect(digests.git_blob_sha1).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
    expect(digests.size).toBe(0);
  });

  test('getObjectDigests of a missing object is a 404', async () => {
    const error = await client.getObjectDigests('files', 'missing.bin').catch(error => error);

    expect(error).toBeInstanceOf(ObjectStorageError);
    expect((error as ObjectStorageError).statusCode).toBe(404);
  });
});
