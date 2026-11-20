import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject
} from 'node:crypto';

export let EGRESS_GRANT_AUDIENCE = 'metorial-egress';

let ed25519Pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');

// Canonical claim order (packages/egress vectors): the gateway doesn't care, but the TS and Go
// minting tests compare tokens byte for byte.
let grantClaimOrder = [
  'iss',
  'aud',
  'jti',
  'tenantId',
  'functionId',
  'effectiveFunctionId',
  'functionVersionId',
  'enclaveId',
  'enclaveIdentifier',
  'buildRunId',
  'source',
  'policy',
  'allowAll',
  'platformRoutes',
  'iat',
  'nbf',
  'exp'
] as const;

export type RuntimeSigningKey = {
  kid: string;
  privateKey: KeyObject;
  publicKey: Buffer;
};

export type EgressGrantPolicy = {
  entries: { cidr: string; portRange?: { from: number; to: number } }[];
  hosts?: { pattern: string; ports?: number[] }[];
};

export type EgressGrantClaims = {
  iss: 'function-bay' | 'forge' | 'mcp-runtime' | 'slates-hub';
  aud: typeof EGRESS_GRANT_AUDIENCE;
  jti: string;
  tenantId?: string;
  functionId?: string;
  effectiveFunctionId?: string;
  functionVersionId?: string;
  enclaveId?: string;
  enclaveIdentifier?: string;
  buildRunId?: string;
  source: 'lambda' | 'knative' | 'build' | 'mcp';
  policy?: EgressGrantPolicy;
  allowAll?: boolean;
  platformRoutes?: string[];
  iat: number;
  nbf?: number;
  exp: number;
};

export let runtimeKeyId = (publicKey: Uint8Array) =>
  createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

export let loadRuntimeSigningKey = (d: { seed: string; kid?: string }): RuntimeSigningKey => {
  let seed = Buffer.from(d.seed.trim(), 'base64url');
  if (seed.length !== 32) {
    throw new Error('Ed25519 signing key must be the base64url encoded 32-byte seed');
  }

  let privateKey = createPrivateKey({
    key: Buffer.concat([ed25519Pkcs8Prefix, seed]),
    format: 'der',
    type: 'pkcs8'
  });
  let publicKey = Buffer.from(
    createPublicKey(privateKey).export({ format: 'jwk' }).x!,
    'base64url'
  );

  return { kid: d.kid || runtimeKeyId(publicKey), privateKey, publicKey };
};

export let encodePublicKeySet = (keys: Pick<RuntimeSigningKey, 'kid' | 'publicKey'>[]) => ({
  keys: Object.fromEntries(keys.map(key => [key.kid, key.publicKey.toString('base64url')]))
});

export let pickInOrder = (claims: Record<string, unknown>, order: readonly string[]) => {
  let ordered: Record<string, unknown> = {};
  for (let key of order) {
    if (claims[key] !== undefined) ordered[key] = claims[key];
  }

  return ordered;
};

let canonicalPolicy = (policy: EgressGrantPolicy): EgressGrantPolicy => ({
  entries: policy.entries.map(entry => ({
    cidr: entry.cidr,
    ...(entry.portRange
      ? { portRange: { from: entry.portRange.from, to: entry.portRange.to } }
      : {})
  })),
  ...(policy.hosts
    ? {
        hosts: policy.hosts.map(host => ({
          pattern: host.pattern,
          ...(host.ports ? { ports: host.ports } : {})
        }))
      }
    : {})
});

export let signJwt = (key: RuntimeSigningKey, claims: Record<string, unknown>) => {
  let header = Buffer.from(
    JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: key.kid })
  ).toString('base64url');
  let payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  let signature = sign(null, Buffer.from(`${header}.${payload}`), key.privateKey);

  return `${header}.${payload}.${signature.toString('base64url')}`;
};

export let signEgressGrant = (key: RuntimeSigningKey, claims: EgressGrantClaims) =>
  signJwt(
    key,
    pickInOrder(
      {
        ...claims,
        policy: claims.policy ? canonicalPolicy(claims.policy) : undefined,
        allowAll: claims.allowAll ? true : undefined
      },
      grantClaimOrder
    )
  );

export * from './gateway';
