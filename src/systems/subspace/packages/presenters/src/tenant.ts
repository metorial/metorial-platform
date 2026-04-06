import type { Tenant } from '@metorial-subspace/db';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'tenant',

  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,

  onlyAllowTrustedProviders: tenant.onlyAllowTrustedProviders,

  createdAt: tenant.createdAt
});
