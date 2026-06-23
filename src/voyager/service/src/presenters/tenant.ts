import type { Tenant } from '../../prisma/generated/client';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'voyager#tenant',

  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,

  createdAt: tenant.createdAt
});
