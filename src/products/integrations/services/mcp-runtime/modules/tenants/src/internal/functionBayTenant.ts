import type { Tenant } from '@mtsrc/mcp-runtime-db';
import { isGatewayEgress } from '@mtsrc/mcp-runtime-network';

// Egress grants are attributed to the Function Bay tenant, which network logs are listed by.
// Function Bay is imported lazily because loading it registers the runtime's own tenant.
export let linkFunctionBayTenant = async (tenant: Tenant) => {
  if (!isGatewayEgress() || tenant.functionBayTenantId) return tenant;

  try {
    let { getTenantForFunctionBay } = await import('@mtsrc/mcp-runtime-function-bay');
    let functionBayTenant = await getTenantForFunctionBay(tenant);

    return { ...tenant, functionBayTenantId: functionBayTenant.id };
  } catch (err) {
    console.error(`Unable to link tenant ${tenant.id} to its Function Bay tenant`, err);
    return tenant;
  }
};
