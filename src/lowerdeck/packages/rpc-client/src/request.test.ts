import { afterEach, describe, expect, test, vi } from 'vitest';
import { rpcSignatureHeader, verifyRpcSignature } from '@lowerdeck/rpc-signature';
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

  test('signs the final request body when a signature token provider is configured', async () => {
    let token = 'rpc-secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      let body = init?.body as string;
      let headers = init?.headers as Record<string, string>;
      let id = JSON.parse(body).calls[0].id;

      expect(headers[rpcSignatureHeader]).toBeDefined();
      expect(
        verifyRpcSignature({
          token,
          method: 'POST',
          url: String(input),
          body,
          signatureHeader: headers[rpcSignatureHeader]
        })
      ).toBe(true);

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
        signature: token,
        context: {}
      })
    ).resolves.toMatchObject({
      data: null,
      status: 200
    });
  });

  test('includes headers paired with the signature secret', async () => {
    let token = 'rpc-secret';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      let body = init?.body as string;
      let headers = init?.headers as Record<string, string>;
      let id = JSON.parse(body).calls[0].id;

      expect(headers['metorial-cell-id']).toBe('eu1');
      expect(headers['metorial-cell-token-id']).toBe('cell-token-1');
      expect(
        verifyRpcSignature({
          token,
          method: 'POST',
          url: String(input),
          body,
          signatureHeader: headers[rpcSignatureHeader]
        })
      ).toBe(true);

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
      data: null,
      status: 200
    });
  });

  test('does not include a signature header when no token provider is configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      let body = JSON.parse(init?.body as string);
      let headers = init?.headers as Record<string, string>;
      let id = body.calls[0].id;

      expect(headers[rpcSignatureHeader]).toBeUndefined();

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
});
