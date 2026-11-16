import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { loadSigningKey, mintBuildGrant, signJwt } from './egressGrant';

let vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../../packages/egress/testdata/vectors.json'),
    'utf-8'
  )
);

let keyFor = (name: string) => vectors.keys.find((key: any) => key.name === name);

describe('egress grant minting', () => {
  it('derives the default key id and public key from the seed', () => {
    for (let key of vectors.keys) {
      let loaded = loadSigningKey(key.seed);

      expect(loaded.publicKey.toString('base64url')).toBe(key.publicKey);
      if (key.name !== 'function-bay-explicit-kid') expect(loaded.kid).toBe(key.kid);
    }
  });

  it('rejects seeds that are not 32 bytes', () => {
    expect(() => loadSigningKey('c2hvcnQ')).toThrow('32-byte');
  });

  it('reproduces every mintable grant vector byte for byte', () => {
    let mintable = vectors.grants.filter((grant: any) => grant.mintable);
    expect(mintable.length).toBeGreaterThan(0);

    for (let grant of mintable) {
      let key = keyFor(grant.signer);
      let token = signJwt(loadSigningKey(key.seed, key.kid), grant.claims);

      expect(token, grant.name).toBe(grant.token);
    }
  });

  it('mints the canonical build grant', () => {
    let vector = vectors.grants.find((grant: any) => grant.name === 'build-grant');
    let key = keyFor('forge');

    let token = mintBuildGrant(loadSigningKey(key.seed), {
      buildRunId: vector.claims.buildRunId,
      tenantId: vector.claims.tenantId,
      policy: vector.claims.policy,
      issuedAt: vector.claims.iat,
      expiresAt: vector.claims.exp
    });

    expect(token).toBe(vector.token);
  });

  it('omits the tenant when it is unknown', () => {
    let key = loadSigningKey(keyFor('forge').seed);

    let token = mintBuildGrant(key, {
      buildRunId: 'fwor_1',
      policy: { entries: [] },
      issuedAt: 100,
      expiresAt: 200
    });

    expect(JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())).toEqual({
      iss: 'forge',
      aud: 'metorial-egress',
      jti: 'fwor_1',
      buildRunId: 'fwor_1',
      source: 'build',
      policy: { entries: [] },
      iat: 100,
      nbf: 100,
      exp: 200
    });
  });
});
