import type { Environment, Solution, Tenant } from '@metorial-subspace/db';

export let checkTenant = <
  T extends
    | {
        tenantOid?: bigint | null;
        solutionOid?: number | null;
        environmentOid?: bigint | null;
      }
    | null
    | undefined
>(
  tenantData: {
    tenant: Tenant;
    environment: Environment | null;
    solution?: Solution | null;
  },
  entity: T
) => {
  if (!entity) return;

  if (entity.tenantOid && entity.tenantOid !== tenantData.tenant.oid) {
    throw new Error('Tenant mismatch');
  }

  if (entity.environmentOid && entity.environmentOid !== tenantData.environment?.oid) {
    throw new Error('Environment mismatch');
  }

  if (
    tenantData.solution &&
    entity.solutionOid &&
    entity.solutionOid !== tenantData.solution.oid
  ) {
    throw new Error('Solution mismatch');
  }
};
