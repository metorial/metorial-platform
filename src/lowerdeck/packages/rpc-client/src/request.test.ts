import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { rpcSignatureHeader, verifyRpcSignature } from '@lowerdeck/rpc-signature';
import { serialize } from '@lowerdeck/serialize';

let originalWindow = (globalThis as any).window;
let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let importRequest = async (key: string) =>
  // @ts-ignore Test-only cache buster to force a fresh module instance.
  ((await import(`./request?test=${key}`)) as typeof import('./request')).request;

let importClientBuilder = async (key: string) =>
  // @ts-ignore Test-only cache buster to force a fresh module instance.
  (
    (await import(
      `./shared/clientBuilder?test=${key}`
    )) as typeof import('./shared/clientBuilder')
  ).clientBuilder;

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
      expect(String(input)).toBe('http://localhost/rpc/health.check');
      expect(serialize.decode(init?.body as string)).toEqual({ hello: 'world' });

      return new Response(serialize.encode({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest('single-route');

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: { hello: 'world' },
        headers: {},
        useDirectMethodRoute: true,
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
      expect(String(input)).toBe('http://localhost/rpc/health.check?foo=bar&baz=qux');
      expect(serialize.decode(init?.body as string)).toEqual({ ok: true });

      return new Response(serialize.encode({ done: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest('single-route-query');

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: { ok: true },
        headers: {},
        query: { foo: 'bar', baz: 'qux' },
        useDirectMethodRoute: true,
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

    let request = await importRequest('single-route-null');

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: {},
        headers: {},
        useDirectMethodRoute: true,
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

    let request = await importRequest('single-route-payload');

    let res = await request({
      endpoint: 'http://localhost/rpc',
      name: 'health:check',
      payload: {},
      headers: {},
      useDirectMethodRoute: true,
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
      expect(String(input)).toBe('http://localhost/rpc/health.check');
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

    let request = await importRequest('single-route-signature');

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: { signed: true },
        headers: {},
        signature: token,
        useDirectMethodRoute: true,
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

    let request = await importRequest('single-route-signature-headers');

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
        useDirectMethodRoute: true,
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

    let request = await importRequest('single-route-no-signature');

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: {},
        headers: {},
        useDirectMethodRoute: true,
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

    let request = await importRequest('single-route-error');

    await expect(
      request({
        endpoint: 'http://localhost/rpc',
        name: 'health:check',
        payload: {},
        headers: {},
        useDirectMethodRoute: true,
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

    let request = await importRequest('browser-batch');

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

  test('keeps single calls on the batch endpoint unless the direct route is enabled', async () => {
    (globalThis as any).window = {};

    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://localhost/rpc');

      let body = JSON.parse(init?.body as string);
      expect(body.calls).toHaveLength(1);
      expect(body.calls[0].name).toBe('test:single');

      return createBatchResponse([{ id: body.calls[0].id, result: 'batched-single' }]);
    });

    let request = await importRequest('browser-single-default');

    let single = request({
      endpoint: 'http://localhost/rpc',
      name: 'test:single',
      payload: { value: 'single' },
      headers: {},
      context: {}
    });

    await sleep(25);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await expect(single).resolves.toMatchObject({ data: 'batched-single', status: 200 });
  });

  test('sends a single queued browser call to the direct method route', async () => {
    (globalThis as any).window = {};

    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://localhost/rpc/test.single');
      expect(serialize.decode(init?.body as string)).toEqual({ value: 'single' });

      return new Response(serialize.encode({ ok: 'single' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    let request = await importRequest('browser-single');

    let single = request({
      endpoint: 'http://localhost/rpc',
      name: 'test:single',
      payload: { value: 'single' },
      headers: {},
      useDirectMethodRoute: true,
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

  test('sends disableBatching requests immediately and on their own', async () => {
    (globalThis as any).window = {};

    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(String(input)).toBe('http://localhost/rpc');
      let body = JSON.parse(init?.body as string);
      let firstCall = body.calls[0];

      if (firstCall.name == 'test:immediate') {
        expect(firstCall.name).toBe('test:immediate');
        expect(firstCall.payload).toEqual({ value: 'immediate' });

        return createBatchResponse([{ id: firstCall.id, result: 'immediate' }]);
      }

      expect(firstCall.name).toBe('test:batched');
      expect(firstCall.payload).toEqual({ value: 'batched' });

      return createBatchResponse([{ id: firstCall.id, result: 'batched' }]);
    });

    let request = await importRequest('browser-disable-batching');

    let immediate = request({
      endpoint: 'http://localhost/rpc',
      name: 'test:immediate',
      payload: { value: 'immediate' },
      headers: {},
      disableBatching: true,
      context: {}
    });
    let batched = request({
      endpoint: 'http://localhost/rpc',
      name: 'test:batched',
      payload: { value: 'batched' },
      headers: {},
      context: {}
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    let [, firstInit] = fetchSpy.mock.calls[0]!;
    expect(JSON.parse(firstInit?.body as string).calls[0].payload).toEqual({
      value: 'immediate'
    });

    await sleep(25);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    let [, secondInit] = fetchSpy.mock.calls[1]!;
    expect(JSON.parse(secondInit?.body as string).calls[0].payload).toEqual({
      value: 'batched'
    });

    await expect(immediate).resolves.toMatchObject({ data: 'immediate', status: 200 });
    await expect(batched).resolves.toMatchObject({ data: 'batched', status: 200 });
  });

  test('uses client-level disableBatching by default and allows per-call override', async () => {
    let requestSpy = vi.fn(async call => ({
      data: { disableBatching: call.disableBatching ?? false },
      status: 200,
      headers: {}
    }));

    let createClient = await importClientBuilder('client-disable-batching');
    createClient = createClient(requestSpy);

    let client = createClient<{
      test: {
        call: (
          input: { value: string },
          opts?: { disableBatching?: boolean }
        ) => Promise<{ disableBatching: boolean }>;
      };
    }>({
      endpoint: 'http://localhost/rpc',
      disableBatching: true
    });

    await expect(client.test.call({ value: 'default' })).resolves.toEqual({
      disableBatching: true
    });
    await expect(
      client.test.call({ value: 'override' }, { disableBatching: false })
    ).resolves.toEqual({
      disableBatching: false
    });

    expect(requestSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'test:call',
        disableBatching: true
      })
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'test:call',
        disableBatching: false
      })
    );
  });

  test('forwards client-level direct-route opt-in to the requester', async () => {
    let requestSpy = vi.fn(async call => ({
      data: { useDirectMethodRoute: call.useDirectMethodRoute ?? false },
      status: 200,
      headers: {}
    }));

    let createClient = await importClientBuilder('client-direct-route');
    createClient = createClient(requestSpy);

    let client = createClient<{
      test: {
        call: (input: { value: string }) => Promise<{ useDirectMethodRoute: boolean }>;
      };
    }>({
      endpoint: 'http://localhost/rpc',
      useDirectMethodRoute: true
    });

    await expect(client.test.call({ value: 'default' })).resolves.toEqual({
      useDirectMethodRoute: true
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test:call',
        useDirectMethodRoute: true
      })
    );
  });

  test('forwards referrerPolicy to fetch', async () => {
    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      expect(init?.referrerPolicy).toBe('unsafe-url');
      let body = JSON.parse(init?.body as string);

      return createBatchResponse([{ id: body.calls[0].id, result: { ok: true } }]);
    });

    let createClient = await importClientBuilder('client-referrer-policy');
    createClient = createClient(await importRequest('client-referrer-policy-request'));

    let client = createClient<{
      test: {
        call: (input: { value: string }) => Promise<{ ok: boolean }>;
      };
    }>({
      endpoint: 'http://localhost/rpc',
      referrerPolicy: 'unsafe-url'
    });

    await expect(client.test.call({ value: 'ok' })).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
