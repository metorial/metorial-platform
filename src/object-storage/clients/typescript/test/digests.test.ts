import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Subprocess } from 'bun';
import { ObjectStorageClient, ObjectStorageError } from '../src/index';

const WORKSPACE = resolve(import.meta.dir, '../../..');
const BINARY = join(WORKSPACE, 'target/debug/object-store-service');

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });

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
  const root = mkdtempSync(join(tmpdir(), 'object-store-digests-'));
  let server: Subprocess | undefined;
  let url = '';
  let client: ObjectStorageClient;

  beforeAll(async () => {
    const build = Bun.spawnSync(['cargo', 'build', '-p', 'object-store', '--bin', 'object-store-service'], {
      cwd: WORKSPACE,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (build.exitCode !== 0 || !existsSync(BINARY)) throw new Error('cargo build failed');

    const port = await freePort();
    url = `http://127.0.0.1:${port}`;
    const configPath = join(root, 'config.toml');
    writeFileSync(
      configPath,
      [
        '[server]',
        'host = "127.0.0.1"',
        `port = ${port}`,
        '[backend]',
        'type = "local"',
        `root_path = "${join(root, 'data')}"`,
        'physical_bucket = "store"',
      ].join('\n')
    );

    server = Bun.spawn([BINARY], {
      env: { ...process.env, CONFIG_PATH: configPath, RUST_LOG: 'warn' },
      stdout: 'ignore',
      stderr: 'inherit',
    });

    client = new ObjectStorageClient(url, 30_000);
    for (let tries = 0; ; tries++) {
      try {
        await client.ping();
        break;
      } catch (error) {
        if (tries > 100) throw error;
        await Bun.sleep(100);
      }
    }

    await client.createBucket('files');
  }, 300_000);

  afterAll(async () => {
    server?.kill('SIGKILL');
    await server?.exited;
    rmSync(root, { recursive: true, force: true });
  });

  test('putObject returns every digest of what it stored', async () => {
    const data = randomBytes(3 * 1024 * 1024 + 7);

    const stored = await client.putObject('files', 'sized.bin', data);

    expect(stored.digests).toEqual(reference(data));
    expect(stored.size).toBe(data.length);
  });

  test('a streamed upload leaves the git blob id to getObjectDigests', async () => {
    const data = randomBytes(20 * 1024 * 1024 + 3);

    const response = await fetch(`${url}/buckets/files/objects/dir/streamed.bin`, {
      method: 'PUT',
      body: chunked(data, 1024 * 1024),
      duplex: 'half',
    } as RequestInit);
    expect(response.status).toBe(200);
    const uploaded = await response.json();
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
