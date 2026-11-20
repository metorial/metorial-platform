import {
  createEgressGatewayClient,
  loadRuntimeSigningKey,
  type EgressGatewayClient,
  type EgressGrantLifetime,
  type RuntimeSigningKey
} from '@metorial-platform-systems/runtime-egress-grants';
import { ID } from '@mtsrc/mcp-runtime-db';
import {
  defaultRequestGrantTtlSeconds,
  defaultStreamGrantTtlSeconds,
  egressSettings
} from '../env';
import type { EgressContext } from './context';

export type { EgressGrantLifetime };

let signingKey: RuntimeSigningKey | undefined;
let client: EgressGatewayClient | undefined;

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

export let getGatewayProxyUrl = () => {
  let url = egressSettings.gatewayProxyUrl;
  if (!url) {
    throw new Error(
      'SHUTTLE_EGRESS_GATEWAY_PROXY_URL is required when SHUTTLE_EGRESS_MODE is gateway'
    );
  }

  return url;
};

export let getEgressGatewayClient = () =>
  (client ??= createEgressGatewayClient({
    issuer: 'mcp-runtime',
    source: 'mcp',
    proxyUrl: getGatewayProxyUrl(),
    signingKey: getEgressSigningKey(),
    generateGrantId: () => ID.generateIdSync('egressGrant'),
    ttlSeconds: {
      request: egressSettings.requestGrantTtlSeconds ?? defaultRequestGrantTtlSeconds,
      stream: egressSettings.streamGrantTtlSeconds ?? defaultStreamGrantTtlSeconds
    }
  }));

export let toEgressSubject = (egress: EgressContext) => ({
  tenantId: egress.tenantId,
  enclaveId: egress.enclaveId,
  policy: egress.egressPolicy ? { entries: egress.egressPolicy.entries } : undefined
});

export let mintEgressGrant = (
  egress: EgressContext,
  d: { lifetime: EgressGrantLifetime; now?: Date }
) => getEgressGatewayClient().mintGrant(toEgressSubject(egress), d);
