import type { Tenant } from '../../prisma/generated/client';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'function_bay#tenant',

  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,
  isServiceDefault: tenant.isServiceDefault,
  hasAutomaticEnclaveOverride: tenant.hasAutomaticEnclaveOverride,

  createdAt: tenant.createdAt
});
