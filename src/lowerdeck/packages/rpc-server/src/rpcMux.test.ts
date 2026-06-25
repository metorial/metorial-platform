import { createRpcSignatureHeader, rpcSignatureHeader } from '@lowerdeck/rpc-signature';
import { serialize } from '@lowerdeck/serialize';
import { describe, expect, test } from 'vitest';
import { Group } from './controller';
import { rpcMux } from './rpcMux';
import { createServer } from './server';

let createTestRpc = (
  opts: { getSignatureToken?: (request: Request) => Promise<string> | string } = {}
) => {
  let app = new Group().controller({
    ping: new Group()
      .handler()
      .do(async ctx => ({ ok: true, input: ctx.input, rawBody: ctx.rawBody }))
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

describe('rpcMux signatures', () => {
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
    let signatureHeader = createRpcSignatureHeader({
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
    let signatureHeader = createRpcSignatureHeader({
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
});
