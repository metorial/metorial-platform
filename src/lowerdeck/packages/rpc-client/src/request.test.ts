import { afterEach, describe, expect, test, vi } from 'vitest';
import { request } from './request';

describe('request', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('resolves successful call with null payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      let body = JSON.parse(init?.body as string);
      let id = body.calls[0].id;

      return new Response(
        JSON.stringify({
          __typename: 'rpc.response',
          calls: [{ id, status: 200, result: null }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

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

  test('does not mutate successful payload fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      let body = JSON.parse(init?.body as string);
      let id = body.calls[0].id;

      return new Response(
        JSON.stringify({
          __typename: 'rpc.response',
          calls: [
            {
              id,
              status: 200,
              result: { ok: true, object: 'custom', value: 1 }
            }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

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
});
