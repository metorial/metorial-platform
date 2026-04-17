import type { Tenant } from '@metorial-subspace/db';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'tenant',

  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,
  logRetentionInDays: tenant.logRetentionInDays,

  onlyAllowTrustedProviders: tenant.onlyAllowTrustedProviders,
  isWhitelabel: tenant.isWhitelabel,

  createdAt: tenant.createdAt
});
