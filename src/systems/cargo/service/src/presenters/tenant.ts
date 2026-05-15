import type { Tenant } from '@metorial-cargo/db';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'cargo#tenant',
  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,
  createdAt: tenant.createdAt
});
