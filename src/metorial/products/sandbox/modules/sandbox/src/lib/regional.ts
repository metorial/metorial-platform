import type { SandboxRegion, SandboxTenant } from '@metorial/db';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import { getRegionClient } from './regions';

export type SandboxTenantWithRegion = SandboxTenant & { region: SandboxRegion };

export let sandboxTenantInclude = { region: true } as const;

export let getRegional = (
  tenant: SandboxTenantWithRegion
): { genesis: GenesisInternalClient; tenantId: string; region: SandboxRegion } => ({
  genesis: getRegionClient(tenant.region.id),
  tenantId: tenant.id,
  region: tenant.region
});

export let groupByTenant = <T extends { tenant: SandboxTenantWithRegion }>(rows: T[]) => {
  let groups = new Map<bigint, { tenant: SandboxTenantWithRegion; rows: T[] }>();

  for (let row of rows) {
    let group = groups.get(row.tenant.oid) ?? { tenant: row.tenant, rows: [] };
    group.rows.push(row);
    groups.set(row.tenant.oid, group);
  }

  return [...groups.values()];
};
