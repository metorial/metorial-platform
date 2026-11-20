import { createHash } from 'node:crypto';
import {
  pickInOrder,
  signJwt,
  type RuntimeSigningKey
} from '@metorial-platform-systems/runtime-egress-grants';

export {
  EGRESS_GRANT_AUDIENCE,
  encodePublicKeySet,
  loadRuntimeSigningKey,
  runtimeKeyId,
  signEgressGrant,
  type EgressGrantClaims,
  type EgressGrantPolicy,
  type RuntimeSigningKey
} from '@metorial-platform-systems/runtime-egress-grants';

export let INVOCATION_TOKEN_AUDIENCE = 'metorial-function-invoke';

let invocationClaimOrder = [
  'iss',
  'aud',
  'jti',
  'functionVersionId',
  'payloadSha256',
  'iat',
  'exp'
] as const;

export type InvocationTokenClaims = {
  iss: 'function-bay';
  aud: typeof INVOCATION_TOKEN_AUDIENCE;
  jti: string;
  functionVersionId: string;
  payloadSha256: string;
  iat: number;
  exp: number;
};

export let payloadSha256 = (payloadJson: string) =>
  createHash('sha256').update(payloadJson, 'utf8').digest('hex');

export let signInvocationToken = (key: RuntimeSigningKey, claims: InvocationTokenClaims) =>
  signJwt(key, pickInOrder(claims, invocationClaimOrder));
