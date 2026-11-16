import { describe, expect, test } from 'vitest';
import {
  createEd25519RpcSignatureHeader,
  parseEd25519RpcSignature,
  verifyEd25519RpcSignature
} from './ed25519';

let keys = async () => {
  let pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  return {
    privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey)
  };
};
let input = {
  keyId: 'dak_test',
  audience: 'https://customer-firehose.test',
  timestamp: 100_000,
  nonce: 'a'.repeat(32),
  method: 'POST',
  url: 'https://customer-firehose.test/rpc?x=1',
  authorization: 'Bearer token',
  body: '{"calls":[]}'
};

describe('Ed25519 RPC signing', () => {
  test('verifies signatures and accepts the clock boundary', async () => {
    let pair = await keys();
    let signatureHeader = await createEd25519RpcSignatureHeader({
      ...input,
      privateKey: pair.privateKey
    });
    expect(
      await verifyEd25519RpcSignature({ ...input, ...pair, signatureHeader, now: 160_000 })
    ).toBe(true);
    expect(
      await verifyEd25519RpcSignature({ ...input, ...pair, signatureHeader, now: 160_001 })
    ).toBe(false);
    expect(
      await verifyEd25519RpcSignature({ ...input, ...pair, signatureHeader, now: 39_999 })
    ).toBe(false);
  });

  test.each(['body', 'authorization', 'url', 'method', 'audience'] as const)(
    'rejects changed %s',
    async field => {
      let pair = await keys();
      let signatureHeader = await createEd25519RpcSignatureHeader({
        ...input,
        privateKey: pair.privateKey
      });
      let changes = {
        body: '{}',
        authorization: 'Bearer other',
        url: 'https://customer-firehose.test/other?x=2',
        method: 'GET',
        audience: 'https://other.test'
      };
      expect(
        await verifyEd25519RpcSignature({
          ...input,
          ...pair,
          [field]: changes[field],
          signatureHeader,
          now: input.timestamp
        })
      ).toBe(false);
    }
  );

  test('rejects different keys and modified signature metadata', async () => {
    let pair = await keys();
    let other = await keys();
    let signatureHeader = await createEd25519RpcSignatureHeader({
      ...input,
      privateKey: pair.privateKey
    });
    expect(
      await verifyEd25519RpcSignature({
        ...input,
        publicKey: other.publicKey,
        signatureHeader,
        now: input.timestamp
      })
    ).toBe(false);
    for (let header of [
      signatureHeader.replace('kid=dak_test', 'kid=dak_other'),
      signatureHeader.replace('nonce=' + input.nonce, 'nonce=' + 'b'.repeat(32)),
      signatureHeader.replace('t=100000', 't=100001')
    ]) {
      expect(
        await verifyEd25519RpcSignature({
          ...input,
          ...pair,
          signatureHeader: header,
          now: input.timestamp
        })
      ).toBe(false);
    }
    expect(parseEd25519RpcSignature(signatureHeader + ',kid=dak_test')).toBeNull();
    expect(
      parseEd25519RpcSignature(signatureHeader.replace('alg=ed25519', 'alg=hmac'))
    ).toBeNull();
  });

  test('generates fresh nonces for each attempt', async () => {
    let pair = await keys();
    let headers = await Promise.all(
      [1, 2].map(() =>
        createEd25519RpcSignatureHeader({
          ...input,
          nonce: undefined,
          privateKey: pair.privateKey
        })
      )
    );
    expect(parseEd25519RpcSignature(headers[0])?.nonce).not.toEqual(
      parseEd25519RpcSignature(headers[1])?.nonce
    );
  });
});
