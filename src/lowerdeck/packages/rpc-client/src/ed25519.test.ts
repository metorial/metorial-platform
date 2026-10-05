import { afterEach, expect, test, vi } from 'vitest';
import {
  parseEd25519RpcSignature,
  rpcSignatureHeader,
  verifyEd25519RpcSignature
} from '@lowerdeck/rpc-signature';
import { internalServerError, unauthorizedError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';

let originalWindow = (globalThis as any).window;
afterEach(() => {
  vi.unstubAllGlobals();
  (globalThis as any).window = originalWindow;
  vi.resetModules();
});
let keys = async () => {
  let pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  return {
    privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey)
  };
};

let batchResponse = (body: string) =>
  new Response(
    serialize.encode({
      __typename: 'rpc.response',
      calls: (serialize.decode(body) as any).calls.map((call: any) => ({
        id: call.id,
        status: 200,
        result: 'ok'
      }))
    }),
    { status: 200 }
  );

test('signs the final authorization and body with a fresh nonce on retry', async () => {
  delete (globalThis as any).window;
  let pair = await keys();
  let headers: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit) => {
      let authorization = new Headers(options.headers).get('authorization')!;
      let signatureHeader = new Headers(options.headers).get(rpcSignatureHeader)!;
      headers.push(signatureHeader);
      expect(
        await verifyEd25519RpcSignature({
          signatureHeader,
          publicKey: pair.publicKey,
          audience: 'https://firehose.test',
          url,
          method: 'POST',
          authorization,
          body: options.body as string
        })
      ).toBe(true);
      if (headers.length === 1)
        return new Response(serialize.encode(internalServerError().toResponse()), {
          status: 500
        });
      return batchResponse(options.body as string);
    })
  );
  let { createClient } = await import('./index');
  let client = createClient<{ ping: (input: {}) => Promise<string> }>({
    endpoint: 'https://firehose.test/rpc',
    headers: { AUTHORIZATION: 'Bearer final' },
    getSignatureCredentials: () => ({
      algorithm: 'ed25519',
      keyId: 'dak_test',
      audience: 'https://firehose.test',
      privateKey: pair.privateKey
    })
  });
  expect(await client.ping({})).toBe('ok');
  expect(headers).toHaveLength(2);
  expect(parseEd25519RpcSignature(headers[0])?.nonce).not.toEqual(
    parseEd25519RpcSignature(headers[1])?.nonce
  );
  expect(() =>
    createClient({
      endpoint: 'https://firehose.test',
      getSignatureToken: () => 'secret',
      getSignatureCredentials: () => ({
        algorithm: 'ed25519',
        keyId: 'dak_test',
        audience: 'https://firehose.test',
        privateKey: pair.privateKey
      })
    })
  ).toThrow('Choose one');
});

test('batches identical credentials and isolates different signing keys', async () => {
  (globalThis as any).window = {};
  let pair = await keys();
  let other = await keys();
  let batches: number[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit) => {
      batches.push((serialize.decode(options.body as string) as any).calls.length);
      return batchResponse(options.body as string);
    })
  );
  let { createClient } = await import('./index');
  let clientFor = (privateKey: JsonWebKey) =>
    createClient<{ ping: (input: {}) => Promise<string> }>({
      endpoint: 'https://firehose.test/rpc',
      headers: { Authorization: 'Bearer employee' },
      getSignatureCredentials: () => ({
        algorithm: 'ed25519',
        keyId: 'dak_same_metadata',
        audience: 'https://firehose.test',
        privateKey
      })
    });
  let one = clientFor(pair.privateKey);
  let two = clientFor(other.privateKey);
  await Promise.all([one.ping({}), one.ping({}), two.ping({})]);
  expect(batches.sort()).toEqual([1, 2]);
});

test('does not retry a serialized authentication failure for a batch request', async () => {
  delete (globalThis as any).window;
  let pair = await keys();
  let fetch = vi.fn(
    async () =>
      new Response(serialize.encode(unauthorizedError().toResponse()), { status: 401 })
  );
  vi.stubGlobal('fetch', fetch);
  let { createClient } = await import('./index');
  let client = createClient<{ ping: (input: {}) => Promise<string> }>({
    endpoint: 'https://firehose.test/rpc',
    getSignatureCredentials: () => ({
      algorithm: 'ed25519',
      keyId: 'dak_test',
      audience: 'https://firehose.test',
      privateKey: pair.privateKey
    })
  });
  await expect(client.ping({})).rejects.toMatchObject({ data: { status: 401 } });
  expect(fetch).toHaveBeenCalledOnce();
});
