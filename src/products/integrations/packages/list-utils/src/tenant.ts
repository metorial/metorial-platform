import type { Environment, Solution, Tenant } from '@metorial-subspace/db';

export interface TenantSelector {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
}

export interface TenantSelectorOptional {
  solution: Solution;
  tenant?: Tenant;
  environment?: Environment;
}
