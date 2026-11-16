import { createRpcSignatureHeader, rpcSignatureHeader } from '@lowerdeck/rpc-signature';
import { serialize } from '@lowerdeck/serialize';
import { describe, expect, test } from 'vitest';
import { Group } from './controller';
import { rpcMux } from './rpcMux';
import { createServer } from './server';

let createTestRpc = (
  opts: {
    getSignatureToken?:
      | ((
          request: Request
        ) => Promise<string | { secret: string; context?: Record<string, any> }>)
      | ((request: Request) => string | { secret: string; context?: Record<string, any> });
  } = {}
) => {
  let app = new Group<{ auth?: string }>().controller({
    ping: new Group<{ auth?: string }>()
      .handler()
      .do(async ctx => ({ ok: true, input: ctx.input, rawBody: ctx.rawBody, auth: ctx.auth }))
  });

  return rpcMux({ path: '/', getSignatureToken: opts.getSignatureToken }, [
    createServer({})(app)
  ]);
};

let createRpcBody = () =>
  serialize.encode({
    calls: [
      {
        id: 'call_1',
        name: 'ping',
        payload: { hello: 'world' }
      }
    ]
  });

let createRpcRequest = (opts: { body: string; signatureHeader?: string }) =>
  new Request('https://example.test/rpc?batch=1', {
    method: 'POST',
    headers: {
      'content-type': 'application/rpc+json',
      ...(opts.signatureHeader ? { [rpcSignatureHeader]: opts.signatureHeader } : {})
    },
    body: opts.body
  });

let createDirectRpcRequest = (opts: {
  path: string;
  body: string;
  signatureHeader?: string;
}) =>
  new Request(`https://example.test/rpc/${opts.path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/rpc+json',
      ...(opts.signatureHeader ? { [rpcSignatureHeader]: opts.signatureHeader } : {})
    },
    body: opts.body
  });

describe('rpcMux signatures', () => {
  test('accepts direct routes without a dollar prefix', async () => {
    let rpc = createTestRpc();
    let response = await rpc.fetch(
      createDirectRpcRequest({
        path: 'ping',
        body: serialize.encode({ hello: 'world' })
      })
    );
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.input).toEqual({ hello: 'world' });
  });

  test('accepts direct routes with a dollar prefix', async () => {
    let rpc = createTestRpc();
    let response = await rpc.fetch(
      createDirectRpcRequest({
        path: '$ping',
        body: serialize.encode({ hello: 'world' })
      })
    );
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.input).toEqual({ hello: 'world' });
  });

  test('accepts dotted handler names for direct routes', async () => {
    let app = new Group().controller({
      user: new Group().controller({
        profile: new Group().handler().do(async ctx => ({ ok: true, input: ctx.input }))
      })
    });
    let rpc = rpcMux({ path: '/' }, [createServer({})(app)]);
    let response = await rpc.fetch(
      createDirectRpcRequest({
        path: 'user.profile',
        body: serialize.encode({ hello: 'world' })
      })
    );
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.input).toEqual({ hello: 'world' });
  });

  test('accepts dotted handler names in batch calls', async () => {
    let app = new Group().controller({
      user: new Group().controller({
        profile: new Group().handler().do(async ctx => ({ ok: true, input: ctx.input }))
      })
    });
    let rpc = rpcMux({ path: '/' }, [createServer({})(app)]);
    let response = await rpc.fetch(
      new Request('https://example.test/rpc?batch=1', {
        method: 'POST',
        headers: {
          'content-type': 'application/rpc+json'
        },
        body: serialize.encode({
          calls: [
            {
              id: 'call_1',
              name: 'user.profile',
              payload: { hello: 'world' }
            }
          ]
        })
      })
    );
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.calls[0].result.input).toEqual({ hello: 'world' });
  });

  test('ignores proprietary connecting-ip headers when resolving request IP', async () => {
    let app = new Group().controller({
      ping: new Group().handler().do(async ctx => ({ ip: ctx.ip ?? null }))
    });

    let rpc = rpcMux({ path: '/' }, [createServer({})(app)]);
    let response = await rpc.fetch(
      new Request('https://example.test/rpc?batch=1', {
        method: 'POST',
        headers: {
          'content-type': 'application/rpc+json',
          'lowerdeck-connecting-ip': '198.51.100.10',
          'metorial-connecting-ip': '198.51.100.11'
        },
        body: createRpcBody()
      })
    );
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.calls[0].result.ip).toBe(null);
  });

  test('accepts unsigned requests when no signature provider is configured', async () => {
    let rpc = createTestRpc();
    let body = createRpcBody();
    let response = await rpc.fetch(createRpcRequest({ body }));
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.calls[0].result).toEqual({
      ok: true,
      input: { hello: 'world' },
      rawBody: body
    });
  });

  test('rejects missing signatures when a signature provider is configured', async () => {
    let rpc = createTestRpc({ getSignatureToken: () => 'rpc-secret' });
    let response = await rpc.fetch(createRpcRequest({ body: createRpcBody() }));

    expect(response.status).toBe(401);
  });

  test('rejects invalid signatures when a signature provider is configured', async () => {
    let rpc = createTestRpc({ getSignatureToken: () => 'rpc-secret' });
    let response = await rpc.fetch(
      createRpcRequest({
        body: createRpcBody(),
        signatureHeader: `t=${Date.now()},v1=${'a'.repeat(64)}`
      })
    );

    expect(response.status).toBe(401);
  });

  test('rejects stale signatures when a signature provider is configured', async () => {
    let rpc = createTestRpc({ getSignatureToken: () => 'rpc-secret' });
    let body = createRpcBody();
    let signatureHeader = await createRpcSignatureHeader({
      token: 'rpc-secret',
      timestamp: Date.now() - 60_001,
      method: 'POST',
      url: 'https://example.test/rpc?batch=1',
      body
    });

    let response = await rpc.fetch(createRpcRequest({ body, signatureHeader }));

    expect(response.status).toBe(401);
  });

  test('accepts valid signatures when a signature provider is configured', async () => {
    let rpc = createTestRpc({ getSignatureToken: async () => 'rpc-secret' });
    let body = createRpcBody();
    let signatureHeader = await createRpcSignatureHeader({
      token: 'rpc-secret',
      timestamp: Date.now(),
      method: 'POST',
      url: 'https://example.test/rpc?batch=1',
      body
    });

    let response = await rpc.fetch(createRpcRequest({ body, signatureHeader }));
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.calls[0].result.ok).toBe(true);
  });

  test('passes signature context through to handlers', async () => {
    let rpc = createTestRpc({
      getSignatureToken: async () => ({
        secret: 'rpc-secret',
        context: { auth: 'verified' }
      })
    });
    let body = createRpcBody();
    let signatureHeader = await createRpcSignatureHeader({
      token: 'rpc-secret',
      timestamp: Date.now(),
      method: 'POST',
      url: 'https://example.test/rpc?batch=1',
      body
    });

    let response = await rpc.fetch(createRpcRequest({ body, signatureHeader }));
    let responseBody = serialize.decode(await response.text()) as any;

    expect(response.status).toBe(200);
    expect(responseBody.calls[0].result.auth).toBe('verified');
  });
});
