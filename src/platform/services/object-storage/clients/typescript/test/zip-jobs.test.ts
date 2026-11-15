import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Subprocess } from 'bun';
import {
  ObjectStorageClient,
  ObjectStorageError,
  ZipJob,
  ZipJobSpec,
  ZipJobTimeoutError,
} from '../src/index';

const WORKSPACE = resolve(import.meta.dir, '../../..');
const BINARY = join(WORKSPACE, 'target/debug/object-store-service');

const spec = (bucket: string, key: string, sources: string[]): ZipJobSpec => ({
  destination: { bucket, key },
  entries: sources.map(source => ({ path: source, source: { bucket: 'sources', key: source } })),
});

const job = (overrides: Partial<ZipJob>): ZipJob => ({
  id: 'job',
  state: 'running',
  attempt: 1,
  specHash: 'hash',
  owner: 'stub',
  progress: { entriesTotal: 1, entriesDone: 0, bytesRead: 0, bytesWritten: 0, bytesEstimate: 0 },
  result: null,
  error: null,
  leaseExpiresAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

const failed = (attempt: number, code: string, retryable: boolean): ZipJob =>
  job({ state: 'failed', attempt, error: { code: code as any, message: code, retryable } });

const completed = (attempt: number): ZipJob =>
  job({
    state: 'completed',
    attempt,
    result: { size: 1, sha256: 'x', etag: 'e', renamedEntries: [] },
  });

const httpError = (status: number, data: unknown, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers });

const connectionRefused = () => new TypeError('Unable to connect. Is the computer able to access the url?');

type Reply = ZipJob | Response | Error;

/** A client whose PUTs and GETs answer from scripts instead of a server. */
const stubbed = (puts: Reply[], gets: Reply[] = []) => {
  const calls: { method: string; params: Record<string, number> }[] = [];
  const replies: Record<string, Reply[]> = { PUT: puts, GET: gets };
  const fetchStub = async (input: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const url = new URL(String(input));
    calls.push({
      method,
      params: Object.fromEntries([...url.searchParams].map(([name, value]) => [name, Number(value)])),
    });
    const reply = replies[method]?.shift();
    if (!reply) throw new Error(`unexpected ${method}`);
    if (reply instanceof Error) throw reply;
    if (reply instanceof Response) return reply;
    return Response.json(reply, {
      status: reply.state === 'queued' || reply.state === 'running' ? 202 : 200,
    });
  };
  const client = new ObjectStorageClient('http://stub.invalid', 30000, {
    fetch: fetchStub as typeof fetch,
  });
  return { client, calls };
};

describe('waitForZipJob retries', () => {
  test('re-submits after retryable failures until maxAttempts', async () => {
    const { client, calls } = stubbed([failed(1, 'backend_error', true), failed(2, 'interrupted', true)]);

    const started = Date.now();
    const result = await client.waitForZipJob('job', spec('out', 'a.zip', ['a']), { maxAttempts: 2 });

    expect(result.state).toBe('failed');
    expect(result.attempt).toBe(2);
    expect(calls.map(call => call.method)).toEqual(['PUT', 'PUT']);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  test('a retryable failure followed by success resolves completed', async () => {
    const { client, calls } = stubbed([job({ state: 'running' }), completed(2)], [failed(1, 'lease_expired', true)]);
    const seen: string[] = [];

    const result = await client.waitForZipJob('job', spec('out', 'a.zip', ['a']), {
      onProgress: progress => seen.push(`${progress.attempt}:${progress.state}`),
    });

    expect(result.state).toBe('completed');
    expect(calls.map(call => call.method)).toEqual(['PUT', 'GET', 'PUT']);
    expect(seen).toEqual(['1:running', '1:failed', '2:completed']);
  });

  test('stops at once on a non-retryable failure or a cancel', async () => {
    const nonRetryable = stubbed([failed(1, 'source_not_found', false)]);
    const result = await nonRetryable.client.waitForZipJob('job', spec('out', 'a.zip', ['a']));
    expect(result.error?.code).toBe('source_not_found');
    expect(nonRetryable.calls).toHaveLength(1);

    const canceled = stubbed([job({ state: 'canceled', error: { code: 'canceled', message: '', retryable: false } })]);
    expect((await canceled.client.waitForZipJob('job', spec('out', 'a.zip', ['a']))).state).toBe('canceled');
    expect(canceled.calls).toHaveLength(1);
  });

  test('retries refused connections, 429 and 503 without using up attempts', async () => {
    const { client, calls } = stubbed(
      [
        connectionRefused(),
        httpError(429, { error: 'busy', code: 'too_many_jobs' }, { 'retry-after': '0' }),
        httpError(503, { error: 'restarting', code: 'shutting_down' }, { 'retry-after': '0' }),
        completed(1),
      ],
    );

    const result = await client.waitForZipJob('job', spec('out', 'a.zip', ['a']), { maxAttempts: 1 });

    expect(result.state).toBe('completed');
    expect(calls).toHaveLength(4);
  });

  test('re-submits when the job record is gone', async () => {
    const { client, calls } = stubbed(
      [job({ state: 'running' }), completed(1)],
      [httpError(404, { error: 'gone', code: 'job_not_found' })],
    );

    expect((await client.waitForZipJob('job', spec('out', 'a.zip', ['a']))).state).toBe('completed');
    expect(calls.map(call => call.method)).toEqual(['PUT', 'GET', 'PUT']);
  });

  test('throws refused requests without retrying', async () => {
    const { client, calls } = stubbed([httpError(409, { error: 'other spec', code: 'spec_conflict' })]);

    const error = await client.waitForZipJob('job', spec('out', 'a.zip', ['a'])).catch(error => error);

    expect(error).toBeInstanceOf(ObjectStorageError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('spec_conflict');
    expect(calls).toHaveLength(1);
  });

  test('gives up after timeoutMs with the last job seen, without busy polling', async () => {
    const running = Array.from({ length: 50 }, () => job({ state: 'running' }));
    const { client, calls } = stubbed([job({ state: 'queued' })], running);

    const started = Date.now();
    const error = await client
      .waitForZipJob('job', spec('out', 'a.zip', ['a']), { timeoutMs: 2500, waitSeconds: 5 })
      .catch(error => error);

    expect(error).toBeInstanceOf(ZipJobTimeoutError);
    expect(error.lastJob.state).toBe('running');
    expect(Date.now() - started).toBeLessThan(3500);
    expect(calls.length).toBeLessThanOrEqual(4);
    expect(calls[0]!.params.wait).toBeLessThanOrEqual(2.5);
  });

  test('a long poll may outlast the client timeout, a plain request may not', async () => {
    const slowFetch = async (_input: string | URL | Request, init?: RequestInit) =>
      await new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json(job({ state: 'running' }))), 300);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(init.signal!.reason);
        });
      });
    const client = new ObjectStorageClient('http://stub.invalid', 100, {
      fetch: slowFetch as typeof fetch,
    });

    expect((await client.getZipJob('job', { waitSeconds: 1 })).state).toBe('running');

    const error = await client.getZipJob('job').catch(error => error);
    expect(error.name).toBe('TimeoutError');
  });
});

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });

class Server {
  process?: Subprocess;
  readonly root = mkdtempSync(join(tmpdir(), 'object-store-zip-jobs-'));
  readonly configPath = join(this.root, 'config.toml');
  port = 0;

  /** `backend` replaces the `[backend]` section; the default is a local data directory. */
  constructor(readonly backend?: string[]) {}

  get url() {
    return `http://127.0.0.1:${this.port}`;
  }

  async start() {
    if (!this.port) {
      this.port = await freePort();
      writeFileSync(
        this.configPath,
        [
          '[server]',
          'host = "127.0.0.1"',
          `port = ${this.port}`,
          'request_timeout_secs = 30',
          '[backend]',
          ...(this.backend ?? [
            'type = "local"',
            `root_path = "${join(this.root, 'data')}"`,
            'physical_bucket = "store"',
          ]),
          '[zip]',
          'max_wait_seconds = 10',
          'shutdown_grace_seconds = 5',
        ].join('\n')
      );
    }

    this.process = Bun.spawn([BINARY], {
      env: { ...process.env, CONFIG_PATH: this.configPath, RUST_LOG: 'warn' },
      stdout: 'ignore',
      stderr: 'inherit',
    });

    const client = new ObjectStorageClient(this.url, 1000);
    for (let tries = 0; ; tries++) {
      try {
        await client.ping();
        return;
      } catch (error) {
        if (tries > 100) throw error;
        await Bun.sleep(100);
      }
    }
  }

  async stop(signal: NodeJS.Signals = 'SIGTERM') {
    this.process?.kill(signal);
    await this.process?.exited;
    this.process = undefined;
  }
}

describe('zip jobs against a live server', () => {
  const server = new Server();
  let client: ObjectStorageClient;
  const slowSources: string[] = [];

  beforeAll(async () => {
    const build = Bun.spawnSync(['cargo', 'build', '-p', 'object-store', '--bin', 'object-store-service'], {
      cwd: WORKSPACE,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (build.exitCode !== 0 || !existsSync(BINARY)) throw new Error('cargo build failed');

    await server.start();
    client = new ObjectStorageClient(server.url);

    await client.createBucket('sources');
    await client.createBucket('exports');
    await client.putObject('sources', 'readme.txt', 'hello zip jobs\n'.repeat(1000), 'text/plain');
    await client.putObject('sources', 'data.bin', randomBytes(256 * 1024));
    for (let index = 0; index < 4; index++) {
      const key = `slow-${index}.bin`;
      await client.putObject('sources', key, randomBytes(8 * 1024 * 1024));
      slowSources.push(key);
    }
  }, 300_000);

  afterAll(async () => {
    await server.stop('SIGKILL');
    rmSync(server.root, { recursive: true, force: true });
  });

  const slowSpec = (key: string): ZipJobSpec => ({
    destination: { bucket: 'exports', key },
    entries: slowSources.map(source => ({
      path: source,
      source: { bucket: 'sources', key: source },
      compression: 'deflate',
    })),
    deflateLevel: 9,
  });

  test('createZipJob waits for the archive, getZipJob and cancelZipJob return it', async () => {
    const archive = spec('exports', 'small.zip', ['readme.txt', 'data.bin']);

    const created = await client.createZipJob('small', archive, { waitSeconds: 10 });
    expect(created.state).toBe('completed');
    expect(created.attempt).toBe(1);
    expect(created.error).toBeNull();
    expect(created.progress.entriesDone).toBe(2);

    const stored = await client.getObject('exports', 'small.zip');
    expect(stored.data.subarray(0, 4).toString('latin1')).toBe('PK\u0003\u0004');
    expect(stored.data.length).toBe(created.result!.size);
    expect(createHash('sha256').update(stored.data).digest('hex')).toBe(created.result!.sha256);

    expect(await client.getZipJob('small')).toEqual(created);
    expect(await client.getZipJob('small', { waitSeconds: 5 })).toEqual(created);
    expect(await client.createZipJob('small', archive)).toEqual(created);
    expect(await client.cancelZipJob('small')).toEqual(created);
  });

  test('cancelZipJob stops a running job', async () => {
    const created = await client.createZipJob('to-cancel', slowSpec('to-cancel.zip'));
    expect(['queued', 'running']).toContain(created.state);

    const canceled = await client.cancelZipJob('to-cancel');
    expect(canceled.state).toBe('canceled');
    expect(canceled.error?.code).toBe('canceled');
    expect((await client.getZipJob('to-cancel', { waitSeconds: 5 })).state).toBe('canceled');

    const missing = await client.headObject('exports', 'to-cancel.zip').catch(error => error);
    expect(missing).toBeInstanceOf(ObjectStorageError);
    expect(missing.statusCode).toBe(404);
  });

  test('refused requests throw with the server code', async () => {
    const codeOf = (promise: Promise<unknown>) =>
      promise.then(
        () => undefined,
        (error: ObjectStorageError) => `${error.statusCode} ${error.code}`
      );

    expect(await codeOf(client.getZipJob('never-created'))).toBe('404 job_not_found');
    expect(await codeOf(client.cancelZipJob('never-created'))).toBe('404 job_not_found');
    expect(await codeOf(client.getZipJob('.hidden'))).toBe('400 invalid_job_id');
    expect(await codeOf(client.createZipJob('a/b', spec('exports', 'x.zip', ['readme.txt'])))).toBe(
      '400 invalid_job_id'
    );
    expect(await codeOf(client.createZipJob('empty', spec('exports', 'x.zip', [])))).toBe('400 invalid_spec');
    expect(
      await codeOf(client.createZipJob('small', spec('exports', 'other.zip', ['readme.txt'])))
    ).toBe('409 spec_conflict');
  });

  test('waitForZipJob stops on a non-retryable failure', async () => {
    const attempts: number[] = [];
    const result = await client.waitForZipJob('missing-source', spec('exports', 'm.zip', ['nope.txt']), {
      onProgress: job => attempts.push(job.attempt),
    });

    expect(result.state).toBe('failed');
    expect(result.error).toMatchObject({ code: 'source_not_found', retryable: false });
    expect(new Set(attempts)).toEqual(new Set([1]));
  });

  test('waitForZipJob re-submits after the server restarts gracefully', async () => {
    const archive = slowSpec('restarted.zip');
    const seen: ZipJob[] = [];

    const waiting = client.waitForZipJob('restarted', archive, {
      waitSeconds: 5,
      timeoutMs: 180_000,
      onProgress: job => seen.push(job),
    });

    for (let polls = 0; ; polls++) {
      const current = await client.getZipJob('restarted').catch(() => undefined);
      if (current?.state === 'running') break;
      if (polls > 100) throw new Error('the job never started');
      await Bun.sleep(50);
    }

    const restart = (async () => {
      await server.stop('SIGTERM');
      await Bun.sleep(1500);
      await server.start();
    })();

    const result = await waiting;
    await restart;

    expect(result.state).toBe('completed');
    expect(result.attempt).toBe(2);
    expect(seen.find(job => job.error?.code === 'interrupted')).toMatchObject({
      state: 'failed',
      attempt: 1,
      error: { retryable: true },
    });

    const stored = await client.getObject('exports', 'restarted.zip');
    expect(createHash('sha256').update(stored.data).digest('hex')).toBe(result.result!.sha256);
  }, 240_000);
});

const S3_ENDPOINT = process.env.OBJECT_STORE_TEST_S3_ENDPOINT;

/** A skills-marketplace export of a few hundred files, on S3 when the emulator is running. */
describe(`a realistic export through waitForZipJob (${S3_ENDPOINT ? 's3' : 'local'})`, () => {
  const server = new Server(
    S3_ENDPOINT
      ? [
          'type = "s3"',
          'region = "us-east-1"',
          `physical_bucket = "${process.env.OBJECT_STORE_TEST_S3_BUCKET ?? 'conformance'}"`,
          `endpoint = "${S3_ENDPOINT}"`,
        ]
      : undefined
  );
  const suffix = `${Date.now().toString(36)}-${process.pid}`;
  const sources = `ts-src-${suffix}`;
  const exports = `ts-out-${suffix}`;
  const files = new Map<string, Buffer>();
  let client: ObjectStorageClient;

  beforeAll(async () => {
    const build = Bun.spawnSync(['cargo', 'build', '-p', 'object-store', '--bin', 'object-store-service'], {
      cwd: WORKSPACE,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (build.exitCode !== 0 || !existsSync(BINARY)) throw new Error('cargo build failed');
    await server.start();
    client = new ObjectStorageClient(server.url);
    await client.createBucket(sources);
    await client.createBucket(exports);

    for (let skill = 0; skill < 40; skill++) {
      const name = skill % 7 === 3 ? `skill-${skill}-ünïcödé-✨` : `skill-${skill}`;
      const text = (lines: number) => Buffer.from(`# ${name}\n` + `step ${skill}: do the thing\n`.repeat(lines));
      files.set(`${name}/SKILL.md`, text(20 + skill));
      files.set(`${name}/README.md`, text(5));
      files.set(`${name}/scripts/run.py`, text(40));
      files.set(`${name}/scripts/__init__.py`, Buffer.alloc(0));
      files.set(`${name}/.env.example`, Buffer.from('TOKEN=\n'));
      files.set(`${name}/assets/icon.png`, randomBytes(2048 + skill * 13));
      files.set(`${name}/assets/model.bin`, randomBytes(64 * 1024));
      files.set(`${name}/docs/guide.md`, text(200));
      files.set(`${name}/docs/api.json`, Buffer.from(JSON.stringify({ skill, tools: [1, 2, 3] })));
      files.set(`${name}/LICENSE`, Buffer.from('MIT License\n'.repeat(30)));
    }

    const queue = [...files.entries()];
    await Promise.all(
      Array.from({ length: 16 }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          await client.putObject(sources, next[0], next[1]);
        }
      })
    );
  }, 300_000);

  afterAll(async () => {
    await server.stop('SIGKILL');
    rmSync(server.root, { recursive: true, force: true });
  });

  test('every file arrives intact', async () => {
    const paths = [...files.keys()];
    const archive: ZipJobSpec = {
      destination: { bucket: exports, key: 'marketplace/export.zip' },
      entries: paths.map(path => ({ path, source: { bucket: sources, key: path } })),
    };
    const progress: ZipJob[] = [];
    const job = await client.waitForZipJob(`ts-export-${suffix}`, archive, {
      waitSeconds: 5,
      timeoutMs: 120_000,
      onProgress: seen => progress.push(seen),
    });

    expect(job.state).toBe('completed');
    expect(job.attempt).toBe(1);
    expect(job.progress.entriesDone).toBe(files.size);
    expect(job.result!.renamedEntries).toEqual([]);

    const stored = await client.getObject(exports, 'marketplace/export.zip');
    expect(stored.data.length).toBe(job.result!.size);
    expect(createHash('sha256').update(stored.data).digest('hex')).toBe(job.result!.sha256);

    const archivePath = join(server.root, 'export.zip');
    writeFileSync(archivePath, stored.data);
    const listed = Bun.spawnSync(
      [
        'python3',
        '-c',
        'import json, sys, zipfile\n' +
          'z = zipfile.ZipFile(sys.argv[1])\n' +
          'assert z.testzip() is None\n' +
          'print(json.dumps([[i.filename, i.file_size, i.CRC] for i in z.infolist()]))',
        archivePath,
      ],
      { stderr: 'inherit' }
    );
    expect(listed.exitCode).toBe(0);
    const entries: [string, number, number][] = JSON.parse(listed.stdout.toString());

    const sorted = [...paths].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    expect(entries.map(([name]) => name)).toEqual(sorted);
    for (const [name, size, crc] of entries) {
      const data = files.get(name)!;
      expect([name, size, crc]).toEqual([name, data.length, Bun.hash.crc32(data)]);
    }
  }, 180_000);
});
