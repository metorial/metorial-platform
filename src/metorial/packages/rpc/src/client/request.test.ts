import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

let originalWindow = (globalThis as any).window;
let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let createRpcResponse = (calls: { id: string; result?: any; status?: number }[]) =>
  new Response(
    JSON.stringify({
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
    (globalThis as any).window = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

  test('batches browser requests by default', async () => {
    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      let body = JSON.parse(init?.body as string);

      return createRpcResponse(
        body.calls.map((call: { id: string; payload: any }) => ({
          id: call.id,
          result: call.payload.value
        }))
      );
    });

    // @ts-ignore Test-only cache buster to force a fresh module instance.
    let { request } = (await import(`./request?test=batch-default`)) as typeof import('./request');

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

  test('sends disableBatching requests immediately and on their own', async () => {
    let fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      let body = JSON.parse(init?.body as string);

      return createRpcResponse(
        body.calls.map((call: { id: string; payload: any }) => ({
          id: call.id,
          result: call.payload.value
        }))
      );
    });

    // @ts-ignore Test-only cache buster to force a fresh module instance.
    let { request } = (await import(`./request?test=disable-batching`)) as typeof import('./request');

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
    let firstBody = JSON.parse(firstInit?.body as string);
    expect(firstBody.calls).toHaveLength(1);
    expect(firstBody.calls[0].name).toBe('test:immediate');

    await sleep(25);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    let [, secondInit] = fetchSpy.mock.calls[1]!;
    let secondBody = JSON.parse(secondInit?.body as string);
    expect(secondBody.calls).toHaveLength(1);
    expect(secondBody.calls[0].name).toBe('test:batched');

    await expect(immediate).resolves.toMatchObject({ data: 'immediate', status: 200 });
    await expect(batched).resolves.toMatchObject({ data: 'batched', status: 200 });
  });
});
