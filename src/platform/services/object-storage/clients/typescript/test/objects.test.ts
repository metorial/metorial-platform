import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { openAsBlob, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ObjectStorageClient, ObjectStorageError, ZipJobSpec } from '../src/index';
import { startLiveServer } from './liveServer';

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

const generated = (totalBytes: number, chunkBytes: number) => {
  const chunk = new Uint8Array(chunkBytes);
  for (let i = 0; i < chunk.length; i++) chunk[i] = (i * 31 + 7) % 256;
  const hash = createHash('sha256');
  let sent = 0;

  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (sent >= totalBytes) {
          controller.close();
          return;
        }
        const next = chunk.subarray(0, Math.min(chunkBytes, totalBytes - sent));
        hash.update(next);
        sent += next.length;
        controller.enqueue(next.slice());
      },
    },
    { highWaterMark: 0 }
  );

  return { stream, digest: () => hash.digest('hex') };
};

const peakRssDuring = async <T>(run: () => Promise<T>) => {
  Bun.gc(true);
  const before = process.memoryUsage().rss;
  let peak = before;
  const sampler = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 5);
  try {
    const result = await run();
    return { result, growth: peak - before };
  } finally {
    clearInterval(sampler);
  }
};

describe('objects against a live server', () => {
  let server: Awaited<ReturnType<typeof startLiveServer>>;
  let client: ObjectStorageClient;

  beforeAll(async () => {
    server = await startLiveServer('objects');
    client = server.client;
  }, 300_000);

  afterAll(async () => {
    await server?.stop();
  });

  test('round-trips bytes, strings and custom metadata', async () => {
    const data = randomBytes(64 * 1024);
    await client.putObject('files', 'nested/a.bin', data, 'application/x-test', { owner: 'tests' });
    await client.putObject('files', 'nested/b.json', '{"ü":1}');

    const object = await client.getObject('files', 'nested/a.bin');
    expect(object.data.equals(data)).toBe(true);
    expect(object.metadata).toMatchObject({
      key: 'nested/a.bin',
      size: data.length,
      content_type: 'application/x-test',
      metadata: { owner: 'tests' },
    });
    expect(object.metadata.etag).not.toBe('');

    const text = await client.getObject('files', 'nested/b.json');
    expect(text.data.toString('utf8')).toBe('{"ü":1}');
    expect(text.metadata.content_type).not.toMatch(/form-urlencoded|text\/plain/);

    const head = await client.headObject('files', 'nested/a.bin');
    expect(head).toMatchObject({ size: data.length, metadata: { owner: 'tests' } });

    const page = await client.listObjectsPage('files', 'nested/', 1);
    expect(page.objects).toHaveLength(1);
    expect(page.nextContinuationToken).toBeDefined();
    expect((await client.listObjects('files', 'nested/')).map(o => o.key).sort()).toEqual([
      'nested/a.bin',
      'nested/b.json',
    ]);

    const range = await client.getObjectRange('files', 'nested/a.bin', { start: 10, end: 19 });
    expect(range.data.equals(data.subarray(10, 20))).toBe(true);
    expect(range.range).toEqual({ start: 10, end: 19, total: data.length });

    const copied = await client.copyObject('files', 'copy/a.bin', 'files', 'nested/a.bin');
    expect(copied.size).toBe(data.length);

    const results = await client.deleteObjects('files', ['nested/b.json', 'copy/a.bin']);
    expect(results.every(r => r.deleted)).toBe(true);
    await client.deleteObject('files', 'nested/a.bin');
    expect(await client.listObjects('files', 'nested/')).toEqual([]);
  });

  test('putObject sends a file-backed Blob from disk with its length', async () => {
    const data = randomBytes(2 * 1024 * 1024 + 1);
    const path = join(server.root, 'upload.bin');
    writeFileSync(path, data);

    const stored = await client.putObject('files', 'file.bin', await openAsBlob(path), 'application/gzip');

    expect(stored.digests.sha256).toBe(sha256(data));
    expect(stored.digests.git_blob_sha1).not.toBeNull();
    expect((await client.headObject('files', 'file.bin')).content_type).toBe('application/gzip');
  });

  test('streams uploads and downloads without holding the object in memory', async () => {
    const size = 256 * 1024 * 1024;
    const source = generated(size, 1024 * 1024);

    const upload = await peakRssDuring(() => client.putObject('files', 'large.bin', source.stream));
    expect(upload.result.size).toBe(size);
    const expected = source.digest();
    expect(upload.result.digests.sha256).toBe(expected);
    expect(upload.growth).toBeLessThan(96 * 1024 * 1024);

    const download = await peakRssDuring(async () => {
      const { metadata, stream } = await client.getObjectStream('files', 'large.bin');
      const hash = createHash('sha256');
      let received = 0;
      for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
        hash.update(chunk);
        received += chunk.length;
      }
      return { metadata, received, digest: hash.digest('hex') };
    });
    expect(download.result.metadata.size).toBe(size);
    expect(download.result.received).toBe(size);
    expect(download.result.digest).toBe(expected);
    expect(download.growth).toBeLessThan(96 * 1024 * 1024);
  }, 120_000);

  test('getObjectStream hands the body over before it has been read', async () => {
    await client.putObject('files', 'lazy.bin', randomBytes(8 * 1024 * 1024));

    const { metadata, stream } = await client.getObjectStream('files', 'lazy.bin');
    expect(metadata.size).toBe(8 * 1024 * 1024);

    const reader = stream.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    await reader.cancel();
  });

  test('a stream that fails mid-upload stores nothing', async () => {
    let sent = 0;
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > 4 * 1024 * 1024) {
          controller.error(new Error('source broke'));
          return;
        }
        sent += 1024 * 1024;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });

    const error = await client.putObject('files', 'broken.bin', failing).catch(error => error);
    expect(error.message).toBe('source broke');

    await Bun.sleep(200);
    const missing = await client.headObject('files', 'broken.bin').catch(error => error);
    expect(missing).toBeInstanceOf(ObjectStorageError);
    expect(missing.statusCode).toBe(404);
  });

  test('createZipJob accepts the spec as a JSON Blob', async () => {
    await client.putObject('files', 'zip/source.txt', 'zipped');
    const spec: ZipJobSpec = {
      destination: { bucket: 'files', key: 'zip/out.zip' },
      entries: [{ path: 'source.txt', source: { bucket: 'files', key: 'zip/source.txt' } }],
    };
    const path = join(server.root, 'spec.json');
    writeFileSync(path, JSON.stringify(spec));

    const job = await client.createZipJob('blob-spec', await openAsBlob(path), { waitSeconds: 10 });

    expect(job.state).toBe('completed');
    expect((await client.headObject('files', 'zip/out.zip')).size).toBe(job.result!.size);
  });

  test('errors carry the status, body and code', async () => {
    const missing = await client.getObject('files', 'missing.bin').catch(error => error);
    expect(missing).toBeInstanceOf(ObjectStorageError);
    expect(missing.statusCode).toBe(404);

    await client.putObject('files', 'zip/conflict.txt', 'a');
    const specFor = (key: string): ZipJobSpec => ({
      destination: { bucket: 'files', key },
      entries: [{ path: 'a.txt', source: { bucket: 'files', key: 'zip/conflict.txt' } }],
    });
    await client.createZipJob('conflict', specFor('zip/first.zip'), { waitSeconds: 10 });

    const conflict = await client
      .createZipJob('conflict', specFor('zip/second.zip'))
      .catch(error => error);
    expect(conflict).toBeInstanceOf(ObjectStorageError);
    expect(conflict).toMatchObject({ statusCode: 409, code: 'spec_conflict' });
  });
});
