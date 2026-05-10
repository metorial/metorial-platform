import type { Tenant } from '../db';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'synthesis#tenant',
  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,
  createdAt: tenant.createdAt
});
