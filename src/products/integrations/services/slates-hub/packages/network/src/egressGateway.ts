import { checkEdition } from '@metorial/editions';
import {
  createEgressGatewayClient,
  loadRuntimeSigningKey,
  type EgressGatewayClient,
  type EgressGatewaySubject
} from '@metorial-platform-systems/runtime-egress-grants';
import type { Tenant } from '@mtsrc/slates-hub-db/client';
import { env } from '@mtsrc/slates-hub-env/env';
import { ID } from '@mtsrc/slates-hub-db/id';

let REQUEST_GRANT_TTL_SECONDS = 300;
let STREAM_GRANT_TTL_SECONDS = 6 * 60 * 60;

let client: EgressGatewayClient | undefined;

// The cloud edition always connects directly; only on-prem routes through the egress gateway.
export let isGatewayEgress = () =>
  checkEdition('on-prem') && env.egress.SLATES_HUB_EGRESS_MODE == 'gateway';

export let getEgressGateway = () => {
  if (client) return client;

  let proxyUrl = env.egress.SLATES_HUB_EGRESS_GATEWAY_PROXY_URL;
  let seed = env.egress.SLATES_HUB_EGRESS_SIGNING_KEY;
  if (!proxyUrl || !seed) {
    throw new Error(
      'SLATES_HUB_EGRESS_GATEWAY_PROXY_URL and SLATES_HUB_EGRESS_SIGNING_KEY are required when SLATES_HUB_EGRESS_MODE is gateway'
    );
  }

  client = createEgressGatewayClient({
    issuer: 'slates-hub',
    source: 'mcp',
    proxyUrl,
    signingKey: loadRuntimeSigningKey({
      seed,
      kid: env.egress.SLATES_HUB_EGRESS_SIGNING_KEY_ID
    }),
    generateGrantId: () => ID.generateIdSync('egressGrant'),
    ttlSeconds: { request: REQUEST_GRANT_TTL_SECONDS, stream: STREAM_GRANT_TTL_SECONDS }
  });

  return client;
};

// Grants carry the Function Bay tenant, which network logs are listed by, so the hub's
// connections show up next to the slate's own. Records without a tenant fall back to the hub's.
// Function Bay is imported lazily because loading it registers the hub's own tenant.
export let resolveEgressSubject = async (d: {
  tenant: Tenant | null;
  enclaveId?: string | null;
  egressPolicy?: SlatesHubPrismaJson.CompiledEgressNetworkAllowList | null;
}): Promise<EgressGatewaySubject> => {
  let { functionBayTenant, getFunctionBayTenantForTenant } =
    await import('@mtsrc/slates-hub-function-bay/functionBay');
  let runtimeTenant = d.tenant
    ? await getFunctionBayTenantForTenant(d.tenant)
    : await functionBayTenant;

  return {
    tenantId: runtimeTenant.id,
    enclaveId: d.enclaveId ?? undefined,
    policy: d.egressPolicy ? { entries: d.egressPolicy.entries } : undefined
  };
};
