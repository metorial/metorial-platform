import type { Tenant } from '@metorial-subspace/db';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'tenant',

  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,
  logRetentionInDays: tenant.logRetentionInDays,
  enforceSessionExpiry: tenant.enforceSessionExpiry,

  onlyAllowTrustedProviders: tenant.onlyAllowTrustedProviders,
  isWhitelabel: tenant.isWhitelabel,

  allowAuthConfigExport: tenant.allowAuthConfigExport,
  allowAuthConfigImport: tenant.allowAuthConfigImport,

  createdAt: tenant.createdAt
});
