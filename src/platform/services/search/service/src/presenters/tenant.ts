import type { Tenant } from '../../prisma/generated/client';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'voyager#tenant',

  id: tenant.id,
  identifier: tenant.identifier,

  createdAt: tenant.createdAt
});
