// Wire-compatibility tests between ldrpc (Go) and the TypeScript reference implementation.
// Run from the ldrpc directory: bun test interop
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  isServiceError,
  notFoundError,
  ServiceError
} from '../../../packages/error/src/index.ts';
import { createClient } from '../../../packages/rpc-client/src/index.ts';
import { createServer, Group, rpcMux } from '../../../packages/rpc-server/src/index.ts';
import { serialize } from '../../../packages/serialize/src/index.ts';
import { v } from '../../../packages/validation/src/index.ts';

let moduleDir = new URL('..', import.meta.url).pathname;
let binDir = `${moduleDir}tmp/interop`;

type Bucket = {
  id: string;
  createdAt: Date;
  expiresAt: Date | null;
  labels: Record<string, string>;
  caller?: string;
};

type EchoPayload = { at: Date; items: { at: Date }[]; big: number; note?: string };

type GoClient = {
  bucket: {
    get: (input: { bucketId: string }) => Promise<Bucket>;
    echo: (input: EchoPayload) => Promise<EchoPayload>;
    void: (input: {}) => Promise<void>;
    empty: (input: {}) => Promise<{}>;
  };
};

let build = async (name: string) => {
  let proc = Bun.spawn(['go', 'build', '-o', `${binDir}/${name}`, `./interop/${name}`], {
    cwd: moduleDir,
    stderr: 'inherit'
  });
  if ((await proc.exited) !== 0) throw new Error(`go build ${name} failed`);
  return `${binDir}/${name}`;
};

let expectServiceError = async (promise: Promise<unknown>, status: number, code: string) => {
  let error = await promise.then(
    () => null,
    e => e
  );
  expect(isServiceError(error)).toBe(true);
  expect(error.data.status).toBe(status);
  expect(error.data.code).toBe(code);
  return error;
};

describe('TypeScript client -> Go server', () => {
  let server: ReturnType<typeof Bun.spawn>;
  let baseUrl = '';
  let keyPair: CryptoKeyPair;

  beforeAll(async () => {
    keyPair = (await crypto.subtle.generateKey('Ed25519', true, [
      'sign',
      'verify'
    ])) as CryptoKeyPair;
    let publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    server = Bun.spawn([await build('goserver')], {
      env: { ...process.env, ED25519_PUBLIC_JWK: JSON.stringify(publicJwk) },
      stdout: 'pipe',
      stderr: 'inherit'
    });

    let reader = (server.stdout as ReadableStream<Uint8Array>).getReader();
    let { value } = await reader.read();
    baseUrl = new TextDecoder().decode(value).trim().replace('listening ', '');
    reader.releaseLock();
  }, 60_000);

  afterAll(() => server?.kill());

  for (let useDirectMethodRoute of [false, true]) {
    test(`calls, dates and errors (direct route: ${useDirectMethodRoute})`, async () => {
      let client = createClient<GoClient>({
        endpoint: `${baseUrl}/rpc`,
        useDirectMethodRoute,
        retry: false
      });

      let bucket = await client.bucket.get({ bucketId: 'bkt_1' });
      expect(bucket.id).toBe('bkt_1');
      expect(bucket.createdAt).toBeInstanceOf(Date);
      expect(bucket.createdAt.getTime()).toBe(1_700_000_000_123);
      expect(bucket.expiresAt).toBeNull();
      expect(bucket.labels).toEqual({ env: 'test' });

      let input = { at: new Date(5), items: [{ at: new Date(6) }], big: 2 ** 53 - 1 };
      let echoed = await client.bucket.echo(input);
      expect(echoed.at).toBeInstanceOf(Date);
      expect(echoed.at.getTime()).toBe(5);
      expect(echoed.items[0]!.at).toBeInstanceOf(Date);
      expect(echoed.items[0]!.at.getTime()).toBe(6);
      expect(echoed.big).toBe(2 ** 53 - 1);
      expect('note' in echoed).toBe(false);

      expect(await client.bucket.void({})).toBeNull();
      expect(await client.bucket.empty({})).toEqual({});

      let missing = await expectServiceError(
        client.bucket.get({ bucketId: 'missing' }),
        404,
        'not_found'
      );
      expect(missing.data.entity).toBe('bucket');

      let invalid = await expectServiceError(
        client.bucket.get({ bucketId: '' }),
        400,
        'invalid_data'
      );
      expect(invalid.data.entity).toBe('call_data');
      expect(invalid.data.errors[0].path).toEqual(['bucketId']);

      await expectServiceError((client as any).bucket.nope({}), 404, 'not_found');
    });
  }

  test('batch envelope', async () => {
    let res = await fetch(`${baseUrl}/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/rpc+json' },
      body: serialize.encode({
        calls: [
          { id: 'c1', name: 'bucket:echo', payload: { at: new Date(7), items: [], big: 1 } },
          { id: 'c2', name: 'bucket.get', payload: { bucketId: 'missing' } }
        ]
      })
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('metorial-req-id')).toStartWith('req_');

    let body = serialize.decode(await res.text());
    expect(body.__typename).toBe('rpc.response');
    expect(body.calls.map((c: any) => [c.id, c.name, c.status])).toEqual([
      ['c1', 'bucket:echo', 200],
      ['c2', 'bucket:get', 404]
    ]);
    expect(body.calls[0].result.at).toBeInstanceOf(Date);
    expect(body.calls[1].result).toMatchObject({
      object: 'error',
      ok: false,
      code: 'not_found'
    });
  });

  test('HMAC signatures', async () => {
    let signed = createClient<GoClient>({
      endpoint: `${baseUrl}/signed?region=eu`,
      getSignatureToken: () => 'shared-secret',
      retry: false
    });
    expect((await signed.bucket.get({ bucketId: 'a' })).id).toBe('a');

    let wrong = createClient<GoClient>({
      endpoint: `${baseUrl}/signed`,
      getSignatureToken: () => 'wrong',
      retry: false
    });
    await expectServiceError(wrong.bucket.get({ bucketId: 'a' }), 401, 'unauthorized');
  });

  test('Ed25519 signatures', async () => {
    let privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    let signed = createClient<GoClient>({
      endpoint: `${baseUrl}/ed25519`,
      headers: { authorization: 'Bearer abc' },
      getSignatureCredentials: () => ({
        algorithm: 'ed25519',
        keyId: 'ts-caller',
        audience: 'go-interop',
        privateKey
      }),
      retry: false
    });
    expect((await signed.bucket.get({ bucketId: 'a' })).caller).toBe('ts-caller');

    let wrongAudience = createClient<GoClient>({
      endpoint: `${baseUrl}/ed25519`,
      getSignatureCredentials: () => ({
        algorithm: 'ed25519',
        keyId: 'ts-caller',
        audience: 'someone-else',
        privateKey
      }),
      retry: false
    });
    await expectServiceError(wrongAudience.bucket.get({ bucketId: 'a' }), 401, 'unauthorized');
  });
});

describe('Go client -> TypeScript server', () => {
  let server: ReturnType<typeof Bun.serve>;

  beforeAll(() => {
    let app = new Group();
    let controller = app.controller({
      bucket: app.controller({
        get: app
          .handler()
          .input(v.object({ bucketId: v.string() }))
          .do(async ctx => {
            if (ctx.input.bucketId == 'missing')
              throw new ServiceError(notFoundError('bucket', ctx.input.bucketId));
            return {
              id: ctx.input.bucketId,
              createdAt: new Date(1_700_000_000_123),
              tags: ['a', 'b']
            };
          }),

        echo: app
          .handler()
          .input(v.object({ at: v.date(), count: v.number() }))
          .do(async ctx => {
            if (!(ctx.input.at instanceof Date)) throw new Error('expected a Date');
            return ctx.input;
          })
      })
    });

    let open = rpcMux({ path: '/rpc' }, [createServer({})(controller)]);
    let signed = rpcMux({ path: '/signed', getSignatureToken: () => 'shared-secret' }, [
      createServer({})(controller)
    ]);

    server = Bun.serve({
      port: 0,
      fetch: req =>
        new URL(req.url).pathname.startsWith('/signed') ? signed.fetch(req) : open.fetch(req)
    });
  });

  afterAll(() => server?.stop(true));

  test('Go client against @lowerdeck/rpc-server', async () => {
    let proc = Bun.spawn([await build('goclient'), `http://127.0.0.1:${server.port}`], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    let [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text()
    ]);

    expect(stderr).toBe('');
    expect(stdout.trim()).toBe('ok');
    expect(code).toBe(0);
  }, 60_000);
});
