import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  encodePublicKeySet,
  loadRuntimeSigningKey,
  payloadSha256,
  runtimeKeyId,
  signEgressGrant,
  signInvocationToken
} from './runtimeTokens';

type TokenVector = {
  name: string;
  signer?: string;
  mintable: boolean;
  headerJson?: string;
  claimsJson?: string;
  claims?: Record<string, any>;
  token: string;
};

let vectors = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../../packages/egress/testdata/vectors.json'),
    'utf8'
  )
) as {
  keys: { name: string; kid: string; seed: string; publicKey: string; trusted: boolean }[];
  keySet: { keys: Record<string, string> };
  grants: TokenVector[];
  invocationTokens: TokenVector[];
  payloadHashes: { description: string; payloadJson: string; sha256: string }[];
};

let signingKeys = new Map(
  vectors.keys.map(key => [key.name, loadRuntimeSigningKey({ seed: key.seed, kid: key.kid })])
);

let reversedKeyOrder = (claims: Record<string, any>) =>
  Object.fromEntries(Object.entries(claims).reverse()) as any;

let mintable = (list: TokenVector[]) =>
  list.filter(vector => vector.mintable).map(vector => [vector.name, vector] as const);

describe('runtime signing keys', () => {
  it.each(vectors.keys.map(key => [key.name, key] as const))(
    'derives the public key and default kid for %s',
    (_, vector) => {
      let key = loadRuntimeSigningKey({ seed: vector.seed });

      expect(key.publicKey.toString('base64url')).toBe(vector.publicKey);
      if (vector.name !== 'function-bay-explicit-kid') expect(key.kid).toBe(vector.kid);
      expect(key.kid).toBe(runtimeKeyId(key.publicKey));
    }
  );

  it('keeps an explicit kid', () => {
    let vector = vectors.keys.find(key => key.name === 'function-bay-explicit-kid')!;

    expect(loadRuntimeSigningKey({ seed: vector.seed, kid: vector.kid }).kid).toBe(
      'function-bay-2026-11'
    );
  });

  it('encodes the trusted keys as the trust key set', () => {
    let trusted = vectors.keys
      .filter(key => key.trusted)
      .map(key => signingKeys.get(key.name)!);

    expect(encodePublicKeySet(trusted)).toEqual(vectors.keySet);
  });

  it('rejects seeds that are not 32 bytes', () => {
    expect(() =>
      loadRuntimeSigningKey({ seed: Buffer.alloc(16).toString('base64url') })
    ).toThrow();
  });
});

describe('egress grant minting', () => {
  it.each(mintable(vectors.grants))('reproduces %s byte for byte', (_, vector) => {
    let token = signEgressGrant(
      signingKeys.get(vector.signer!)!,
      reversedKeyOrder(vector.claims!)
    );
    let [header, claims] = token.split('.');

    expect(Buffer.from(header!, 'base64url').toString()).toBe(vector.headerJson);
    expect(Buffer.from(claims!, 'base64url').toString()).toBe(vector.claimsJson);
    expect(token).toBe(vector.token);
  });
});

describe('invocation token minting', () => {
  it.each(mintable(vectors.invocationTokens))('reproduces %s byte for byte', (_, vector) => {
    let token = signInvocationToken(
      signingKeys.get(vector.signer!)!,
      reversedKeyOrder(vector.claims!)
    );

    expect(token).toBe(vector.token);
  });
});

describe('payload hashing', () => {
  it.each(vectors.payloadHashes.map(vector => [vector.description, vector] as const))(
    'hashes the exact UTF-8 bytes (%s)',
    (_, vector) => {
      expect(payloadSha256(vector.payloadJson)).toBe(vector.sha256);
    }
  );
});
