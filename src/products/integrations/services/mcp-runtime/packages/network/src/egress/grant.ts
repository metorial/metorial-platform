import {
  EGRESS_GRANT_AUDIENCE,
  loadRuntimeSigningKey,
  signEgressGrant,
  type RuntimeSigningKey
} from '@metorial-platform-systems/runtime-egress-grants';
import { ID } from '@mtsrc/mcp-runtime-db';
import {
  defaultRequestGrantTtlSeconds,
  defaultStreamGrantTtlSeconds,
  egressSettings
} from '../env';
import type { EgressContext } from './context';

export type EgressGrantLifetime = 'request' | 'stream';

let signingKey: RuntimeSigningKey | undefined;

export let getEgressSigningKey = () => {
  if (signingKey) return signingKey;

  let seed = egressSettings.signingKey;
  if (!seed) {
    throw new Error(
      'SHUTTLE_EGRESS_SIGNING_KEY is required when SHUTTLE_EGRESS_MODE is gateway'
    );
  }

  signingKey = loadRuntimeSigningKey({ seed, kid: egressSettings.signingKeyId });
  return signingKey;
};

let grantTtlSeconds = (lifetime: EgressGrantLifetime) =>
  lifetime == 'stream'
    ? (egressSettings.streamGrantTtlSeconds ?? defaultStreamGrantTtlSeconds)
    : (egressSettings.requestGrantTtlSeconds ?? defaultRequestGrantTtlSeconds);

export let mintEgressGrant = (
  egress: EgressContext,
  d: { lifetime: EgressGrantLifetime; now?: Date }
) => {
  let issuedAt = Math.floor((d.now ?? new Date()).getTime() / 1000);

  return signEgressGrant(getEgressSigningKey(), {
    iss: 'mcp-runtime',
    aud: EGRESS_GRANT_AUDIENCE,
    jti: ID.generateIdSync('egressGrant'),
    tenantId: egress.tenantId,
    enclaveId: egress.enclaveId,
    enclaveIdentifier: egress.enclaveId,
    source: 'mcp',
    policy: egress.egressPolicy ? { entries: egress.egressPolicy.entries } : undefined,
    iat: issuedAt,
    exp: issuedAt + grantTtlSeconds(d.lifetime)
  });
};
