import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { rpcSignatureHeader, verifyRpcSignature } from '@lowerdeck/rpc-signature';
import { serialize } from '@lowerdeck/serialize';

let originalWindow = (globalThis as any).window;
let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let importRequest = async () => {
  vi.resetModules();
  return ((await import('./request')) as typeof import('./request')).request;
};

let createBatchResponse = (calls: { id: string; result?: any; status?: number }[]) =>
  new Response(
    serialize.encode({
      __typename: 'rpc.response',
      calls: calls.map(call => ({
        id: call.id,
        status: call.status ?? 200,
        result: call.result ?? null
      }))
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );

describe('request', () => {
  beforeEach(() => {
    delete (globalThis as any).window;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

  test('posts a single call to the direct method route with the raw payload body', async () => {
    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://localhost/rpc/$health:check');
      expect(serialize.decode(init?.body as string)).toEqual({ hello: 'world' });

      return new Response(serialize.encode({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest();

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: { hello: 'world' },
        headers: {},
        context: {}
      })
    ).resolves.toMatchObject({
      data: { ok: true },
      status: 200
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('preserves query params on single direct-route requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://localhost/rpc/$health:check?foo=bar&baz=qux');
      expect(serialize.decode(init?.body as string)).toEqual({ ok: true });

      return new Response(serialize.encode({ done: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest();

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: { ok: true },
        headers: {},
        query: { foo: 'bar', baz: 'qux' },
        context: {}
      })
    ).resolves.toMatchObject({
      data: { done: true },
      status: 200
    });
  });

  test('resolves successful single-call responses with null payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(serialize.encode(null), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest();

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: {},
        headers: {},
        context: {}
      })
    ).resolves.toMatchObject({
      data: null,
      status: 200
    });
  });

  test('does not mutate successful single-call payload fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        serialize.encode({
          ok: true,
          object: 'custom',
          value: 1
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

    let request = await importRequest();

    let res = await request({
      endpoint: 'http://localhost/rpc',
      name: 'health:check',
      payload: {},
      headers: {},
      context: {}
    });

    expect(res.data).toEqual({
      ok: true,
      object: 'custom',
      value: 1
    });
  });

  test('signs single direct-route requests with the final url and raw payload body', async () => {
    let token = 'rpc-secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      let body = init?.body as string;
      let headers = init?.headers as Record<string, string>;

      expect(headers[rpcSignatureHeader]).toBeDefined();
      expect(String(input)).toBe('http://localhost/rpc/$health:check');
      expect(
        await verifyRpcSignature({
          token,
          method: 'POST',
          url: String(input),
          body,
          signatureHeader: headers[rpcSignatureHeader]
        })
      ).toBe(true);

      return new Response(serialize.encode({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest();

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: { signed: true },
        headers: {},
        signature: token,
        context: {}
      })
    ).resolves.toMatchObject({
      data: { ok: true },
      status: 200
    });
  });

  test('includes headers paired with the signature secret for single direct-route requests', async () => {
    let token = 'rpc-secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      let body = init?.body as string;
      let headers = init?.headers as Record<string, string>;

      expect(headers['metorial-cell-id']).toBe('eu1');
      expect(headers['metorial-cell-token-id']).toBe('cell-token-1');
      expect(
        await verifyRpcSignature({
          token,
          method: 'POST',
          url: String(input),
          body,
          signatureHeader: headers[rpcSignatureHeader]
        })
      ).toBe(true);

      return new Response(serialize.encode({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest();

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: {},
        headers: {
          'metorial-cell-id': 'eu1',
          'metorial-cell-token-id': 'cell-token-1'
        },
        signature: {
          secret: token
        },
        context: {}
      })
    ).resolves.toMatchObject({
      data: { ok: true },
      status: 200
    });
  });

  test('does not include a signature header when no token provider is configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      let headers = init?.headers as Record<string, string>;

      expect(headers[rpcSignatureHeader]).toBeUndefined();

      return new Response(serialize.encode({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest();

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: {},
        headers: {},
        context: {}
      })
    ).resolves.toMatchObject({
      data: { ok: true },
      status: 200
    });
  });

  test('converts non-2xx single-call responses into ServiceError', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          __typename: 'error',
          status: 404,
          code: 'not_found',
          message: 'Missing handler'
        }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    });

    let request = await importRequest();

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: {},
        headers: {},
        context: {}
      })
    ).rejects.toMatchObject({
      object: 'ServiceError'
    });
  });

  test('batches browser requests and keeps the batch envelope for multi-call flushes', async () => {
    (globalThis as any).window = {};

    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://localhost/rpc');

      let body = JSON.parse(init?.body as string);

      return createBatchResponse(
        body.calls.map((call: { id: string; payload: any }) => ({
          id: call.id,
          result: call.payload.value
        }))
      );
    });

    let request = await importRequest();

    let first = request({
      endpoint: 'http://localhost/rpc',
      name: 'test:first',
      payload: { value: 'first' },
      headers: {},
      context: {}
    });
    let second = request({
      endpoint: 'http://localhost/rpc',
      name: 'test:second',
      payload: { value: 'second' },
      headers: {},
      context: {}
    });

    expect(fetchSpy).not.toHaveBeenCalled();

    await sleep(25);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    let [, init] = fetchSpy.mock.calls[0]!;
    let body = JSON.parse(init?.body as string);
    expect(body.calls).toHaveLength(2);

    await expect(first).resolves.toMatchObject({ data: 'first', status: 200 });
    await expect(second).resolves.toMatchObject({ data: 'second', status: 200 });
  });

  test('sends a single queued browser call to the direct method route', async () => {
    (globalThis as any).window = {};

    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://localhost/rpc/$test:single');
      expect(serialize.decode(init?.body as string)).toEqual({ value: 'single' });

      return new Response(serialize.encode({ ok: 'single' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest();

    let single = request({
      endpoint: 'http://localhost/rpc',
      name: 'test:single',
      payload: { value: 'single' },
      headers: {},
      context: {}
    });

    expect(fetchSpy).not.toHaveBeenCalled();

    await sleep(25);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await expect(single).resolves.toMatchObject({
      data: { ok: 'single' },
      status: 200
    });
  });
});
