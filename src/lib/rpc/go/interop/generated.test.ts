// Generated code on both sides of the wire: the generated TypeScript client against the
// generated Go server (example/bucketrpc), the generated Go client against a TypeScript server
// built from the same spec, and identical invalid_data issues from both servers.
// Run from the ldrpc directory: bun test interop
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  createError,
  isServiceError,
  ServiceError
} from '../../../../lowerdeck/packages/error/src/index.ts';
import { compile, createValidatorFactory } from '../../spec/src/index.ts';
import bucketSpec from '../../spec/src/fixtures/bucket.ts';
import { createServer, Group, rpcMux } from '../../node/server/src/index.ts';
import { serialize } from '../../../../lowerdeck/packages/serialize/src/index.ts';
import { createCodeBucketClient } from './generated/bucket.ts';

let moduleDir = new URL('..', import.meta.url).pathname;
let binDir = `${moduleDir}tmp/interop`;
let ir = compile(bucketSpec);

let build = async (name: string) => {
  let proc = Bun.spawn(['go', 'build', '-o', `${binDir}/${name}`, `./interop/${name}`], {
    cwd: moduleDir,
    stderr: 'inherit'
  });
  if ((await proc.exited) !== 0) throw new Error(`go build ${name} failed`);
  return `${binDir}/${name}`;
};

let bucket = (id: string) => ({
  id,
  name: `Bucket ${id}`,
  status: 'active',
  sizeBytes: 42,
  labels: { env: 'test' },
  createdAt: new Date(1_700_000_000_123),
  archivedAt: null
});

let implementation: Record<string, (input: any) => any> = {
  ping: () => ({ ok: true }),
  'bucket:get': ({ bucketId }) => {
    if (bucketId == 'archived') {
      throw new ServiceError(
        createError({
          status: 409,
          code: 'bucket_archived',
          message: 'The bucket is archived.',
          bucketId
        })
      );
    }
    return bucket(bucketId);
  },
  'bucket:list': ({ limit }) => ({
    items: [
      bucket('a'),
      { ...bucket('b'), status: 'archived', archivedAt: new Date(1_700_000_000_456) }
    ],
    nextCursor: limit ? `after-${limit}` : undefined
  }),
  'bucket:archive': ({ bucketId }) => ({ ...bucket(bucketId), status: 'archived' }),
  'bucket:delete': () => null,
  'bucket:files:tree': () => ({
    root: {
      type: 'directory',
      path: '/',
      children: [
        { type: 'file', path: '/index.ts', size: 12 },
        { type: 'directory', path: '/lib', children: [] }
      ]
    }
  }),
  'bucket:files:put': ({ path, content, metadata }) => {
    let decoded = Buffer.from(content, 'base64').toString();
    if (decoded != 'hello' || JSON.stringify(metadata) != '{"a":[1,true]}') {
      throw new Error(`unexpected content ${decoded} ${JSON.stringify(metadata)}`);
    }
    return { entry: { type: 'file', path, size: decoded.length }, version: 2.5 };
  }
};

// A spec-first TypeScript server: input validators come from the IR, like a generated TS
// server stub would use.
let createSpecServer = () => {
  let app = new Group();
  let validators = createValidatorFactory(ir);
  let tree: Record<string, any> = {};

  for (let method of ir.methods) {
    let node = tree;
    for (let segment of method.path.slice(0, -1)) node = node[segment] ??= {};
    node[method.path[method.path.length - 1]!] = app
      .handler()
      .input(validators.methodInput(method.name))
      .do(async ctx => implementation[method.name]!(ctx.input));
  }

  let toController = (node: Record<string, any>): any =>
    app.controller(
      Object.fromEntries(
        Object.entries(node).map(([key, value]) => [
          key,
          value.constructor === Object ? toController(value) : value
        ])
      )
    );

  return rpcMux({ path: '/rpc' }, [createServer({})(toController(tree))]);
};

let goServer: ReturnType<typeof Bun.spawn>;
let goBaseUrl = '';
let tsServer: ReturnType<typeof Bun.serve>;

beforeAll(async () => {
  goServer = Bun.spawn([await build('genserver')], { stdout: 'pipe', stderr: 'inherit' });
  let reader = (goServer.stdout as ReadableStream<Uint8Array>).getReader();
  let { value } = await reader.read();
  goBaseUrl = new TextDecoder().decode(value).trim().replace('listening ', '');
  reader.releaseLock();

  let mux = createSpecServer();
  tsServer = Bun.serve({ port: 0, fetch: req => mux.fetch(req) });
}, 60_000);

afterAll(() => {
  goServer?.kill();
  tsServer?.stop(true);
});

describe('generated TypeScript client -> generated Go server', () => {
  test('every method round-trips', async () => {
    let client = createCodeBucketClient({ endpoint: `${goBaseUrl}/rpc`, retry: false });

    expect(await client.ping()).toEqual({ ok: true });

    let got = await client.bucket.get({ bucketId: 'bkt_1' });
    expect(got).toEqual(bucket('bkt_1') as any);
    expect(got.createdAt).toBeInstanceOf(Date);

    let archived = await client.bucket.get({ bucketId: 'archived' }).catch(e => e);
    expect(isServiceError(archived)).toBe(true);
    expect(archived.data).toMatchObject({
      status: 409,
      code: 'bucket_archived',
      bucketId: 'archived'
    });

    let list = await client.bucket.list({ limit: 10 });
    expect(list.nextCursor).toBe('after-10');
    expect(list.items[1]!.archivedAt).toEqual(new Date(1_700_000_000_456));

    expect(await client.bucket.delete({ bucketId: 'a' })).toBeNull();

    let tree = await client.bucket.files.tree({ bucketId: 'a' });
    expect(tree.root).toEqual({
      type: 'directory',
      path: '/',
      children: [
        { type: 'file', path: '/index.ts', size: 12 },
        { type: 'directory', path: '/lib', children: [] }
      ]
    });

    let put = await client.bucket.files.put({
      bucketId: 'a',
      path: 'src/a.ts',
      content: Buffer.from('hello').toString('base64'),
      metadata: { a: [1, true] },
      mode: 'overwrite'
    });
    expect(put).toEqual({ entry: { type: 'file', path: 'src/a.ts', size: 5 }, version: 2.5 });
  });
});

describe('generated Go client -> TypeScript server built from the spec', () => {
  test('every method round-trips', async () => {
    let proc = Bun.spawn([await build('genclient'), `http://127.0.0.1:${tsServer.port}`], {
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

describe('validation parity', () => {
  let invalid: [method: string, payload: any][] = [
    ['bucket:get', {}],
    ['bucket:get', { bucketId: 5 }],
    ['bucket:get', { bucketId: '' }],
    ['bucket:get', { bucketId: null }],
    ['bucket:list', { status: 'gone' }],
    ['bucket:list', { limit: 0 }],
    ['bucket:list', { limit: 501 }],
    ['bucket:list', { limit: 1.5 }],
    ['bucket:list', { limit: '12' }],
    ['bucket:list', { cursor: 7, limit: 'x' }],
    ['bucket:files:tree', { bucketId: 'a', prefix: false }],
    ['bucket:files:put', { bucketId: 'a', path: '/x', content: 'aGk=', mode: 'overwrite' }],
    ['bucket:files:put', { bucketId: 'a', path: 'x', content: 3, mode: 'append' }],
    ['bucket:files:put', { bucketId: 'a', path: 'x', mode: 'overwrite' }]
  ];

  let call = async (baseUrl: string, method: string, payload: any) => {
    let res = await fetch(`${baseUrl}/rpc/${method.replaceAll(':', '.')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/rpc+json' },
      body: serialize.encode(payload)
    });
    return { status: res.status, body: serialize.decode(await res.text()) };
  };

  for (let [method, payload] of invalid) {
    test(`${method} ${JSON.stringify(payload)}`, async () => {
      let [go, ts] = await Promise.all([
        call(goBaseUrl, method, payload),
        call(`http://127.0.0.1:${tsServer.port}`, method, payload)
      ]);

      expect(ts.status).toBe(400);
      expect(go.status).toBe(400);
      expect(go.body.code).toBe('invalid_data');
      expect(go.body.entity).toBe(ts.body.entity);
      expect(go.body.errors).toEqual(ts.body.errors);
    });
  }
});
