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

export let createEgressContext = (d: {
  tenant: { identifier: string };
  serverInstanceConfiguration?: { enclaveId: string; egressPolicy: unknown } | null;
}): EgressContext => ({
  tenantId: d.tenant.identifier,
  enclaveId: d.serverInstanceConfiguration?.enclaveId,
  egressPolicy:
    (d.serverInstanceConfiguration?.egressPolicy as EgressPolicy | undefined) ?? null
});
