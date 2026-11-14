import type { Tenant } from '../../prisma/generated/client';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'origin#tenant' as const,

  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,

  createdAt: tenant.createdAt
});
