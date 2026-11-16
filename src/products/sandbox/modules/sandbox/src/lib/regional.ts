import { conflictError, ServiceError } from '@lowerdeck/error';
import type { SandboxMachine, SandboxRegion, SandboxTenant } from '@metorial/db';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import { getRegionClient } from './regions';

type GenesisInput<F extends (input: any) => any> = Parameters<F>[0];

export type SandboxMachineEventFilter = Pick<
  GenesisInput<GenesisInternalClient['machine']['event']['list']>,
  'types' | 'sources'
>;

export type SandboxMachineOperationFilter = Pick<
  GenesisInput<GenesisInternalClient['machine']['operation']['list']>,
  'kinds' | 'triggers' | 'outcomes'
>;

export type SandboxMachineInstanceFilter = Pick<
  GenesisInput<GenesisInternalClient['machine']['instance']['list']>,
  'statuses'
>;

export type SandboxDiskResizeFilter = Pick<
  GenesisInput<GenesisInternalClient['disk']['resizeList']>,
  'statuses'
>;

export type SandboxTenantWithRegion = SandboxTenant & { region: SandboxRegion };

export type SandboxMachineWithTenant = SandboxMachine & { tenant: SandboxTenantWithRegion };

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

export let hydrateByTenant = async <
  Row extends { id: string; tenant: SandboxTenantWithRegion },
  Remote extends { id: string }
>(
  rows: Row[],
  fetch: (d: {
    genesis: GenesisInternalClient;
    tenantId: string;
    ids: string[];
  }) => Promise<Remote[]>
) => {
  let remotes = new Map<string, Remote>();

  await Promise.all(
    groupByTenant(rows).map(async group => {
      let { genesis, tenantId } = getRegional(group.tenant);
      let found = await fetch({ genesis, tenantId, ids: group.rows.map(row => row.id) });

      for (let remote of found) remotes.set(remote.id, remote);
    })
  );

  return rows.map(row => ({ ...row, remote: remotes.get(row.id) ?? null }));
};

export let assertMachineActive = (machine: SandboxMachine) => {
  if (machine.status != 'active') {
    throw new ServiceError(
      conflictError({ message: 'Cannot perform this action on a terminated machine' })
    );
  }
};
