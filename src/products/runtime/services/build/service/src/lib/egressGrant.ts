import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'crypto';

let ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export let GRANT_AUDIENCE = 'metorial-egress';

export type SigningKey = { kid: string; privateKey: KeyObject; publicKey: Buffer };

export type EgressPolicy = {
  entries: { cidr: string; portRange?: { from: number; to: number } }[];
  hosts?: { pattern: string; ports?: number[] }[];
};

export let keyIdOf = (publicKey: Buffer) =>
  createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

export let loadSigningKey = (seed: string, kid?: string): SigningKey => {
  let seedBytes = Buffer.from(seed, 'base64url');
  if (seedBytes.length !== 32) {
    throw new Error('Signing key must be a base64url-encoded 32-byte Ed25519 seed');
  }

  let privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seedBytes]),
    format: 'der',
    type: 'pkcs8'
  });
  let publicKey = Buffer.from(
    createPublicKey(privateKey).export({ format: 'jwk' }).x!,
    'base64url'
  );

  return { kid: kid || keyIdOf(publicKey), privateKey, publicKey };
};

export let signJwt = (key: SigningKey, claims: object) => {
  let header = JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: key.kid });
  let signingInput = `${Buffer.from(header).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
  let signature = sign(null, Buffer.from(signingInput), key.privateKey);

  return `${signingInput}.${signature.toString('base64url')}`;
};

// Claim order is canonical (packages/egress vectors): the gateway doesn't care, but the
// TS and Go minting tests compare tokens byte for byte.
export let mintBuildGrant = (
  key: SigningKey,
  d: {
    buildRunId: string;
    tenantId?: string;
    policy: EgressPolicy;
    issuedAt: number;
    expiresAt: number;
  }
) =>
  signJwt(key, {
    iss: 'forge',
    aud: GRANT_AUDIENCE,
    jti: d.buildRunId,
    ...(d.tenantId ? { tenantId: d.tenantId } : {}),
    buildRunId: d.buildRunId,
    source: 'build',
    policy: d.policy,
    iat: d.issuedAt,
    nbf: d.issuedAt,
    exp: d.expiresAt
  });
