import type {} from '@mtsrc/mcp-runtime-db';

export type EgressPolicy = McpRuntimePrismaJson.CompiledEgressNetworkAllowList;

export type EgressContext = {
  tenantId: string;
  enclaveId?: string;
  egressPolicy?: EgressPolicy | null;
};

// Platform requests that belong to no tenant (registry probes, shared discovery documents) are
// attributed to this tenant and, having no policy, may only reach public destinations.
export let systemEgressContext: EgressContext = { tenantId: 'system' };

// Tenants are linked to their Function Bay tenant in gateway mode; until a tenant is linked its
// traffic is attributed to its identifier and does not appear in its network logs.
export let createEgressContext = (d: {
  tenant: { identifier: string; functionBayTenantId: string | null };
  serverInstanceConfiguration?: { enclaveId: string; egressPolicy: unknown } | null;
}): EgressContext => ({
  tenantId: d.tenant.functionBayTenantId ?? d.tenant.identifier,
  enclaveId: d.serverInstanceConfiguration?.enclaveId,
  egressPolicy:
    (d.serverInstanceConfiguration?.egressPolicy as EgressPolicy | undefined) ?? null
});
