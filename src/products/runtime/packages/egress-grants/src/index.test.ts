import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  encodePublicKeySet,
  loadRuntimeSigningKey,
  runtimeKeyId,
  signEgressGrant
} from './index';

type GrantVector = {
  name: string;
  signer?: string;
  mintable: boolean;
  headerJson?: string;
  claimsJson?: string;
  claims?: Record<string, any>;
  token: string;
};

let vectors = JSON.parse(
  readFileSync(resolve(__dirname, '../../egress/testdata/vectors.json'), 'utf8')
) as {
  keys: { name: string; kid: string; seed: string; publicKey: string; trusted: boolean }[];
  keySet: { keys: Record<string, string> };
  grants: GrantVector[];
};

let signingKeys = new Map(
  vectors.keys.map(key => [key.name, loadRuntimeSigningKey({ seed: key.seed, kid: key.kid })])
);

let reversedKeyOrder = (claims: Record<string, any>) =>
  Object.fromEntries(Object.entries(claims).reverse()) as any;

describe('runtime signing keys', () => {
  it.each(vectors.keys.map(key => [key.name, key] as const))(
    'derives the public key for %s',
    (_, vector) => {
      let key = loadRuntimeSigningKey({ seed: vector.seed });

      expect(key.publicKey.toString('base64url')).toBe(vector.publicKey);
      expect(key.kid).toBe(runtimeKeyId(key.publicKey));
    }
  );

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
  it.each(vectors.grants.filter(vector => vector.mintable).map(v => [v.name, v] as const))(
    'reproduces %s byte for byte',
    (_, vector) => {
      let token = signEgressGrant(
        signingKeys.get(vector.signer!)!,
        reversedKeyOrder(vector.claims!)
      );
      let [header, claims] = token.split('.');

      expect(Buffer.from(header!, 'base64url').toString()).toBe(vector.headerJson);
      expect(Buffer.from(claims!, 'base64url').toString()).toBe(vector.claimsJson);
      expect(token).toBe(vector.token);
    }
  );
});
