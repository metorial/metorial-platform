import type { App, Tenant } from '../../../../prisma/generated/client';

export let tenantPresenter = (
  tenant: Tenant & {
    app?: App;
    _count?: { users?: number };
  }
) => ({
  object: 'ares#tenant' as const,

  id: tenant.id,
  clientId: tenant.clientId,

  appId: tenant.app?.id,

  counts: {
    users: tenant._count?.users ?? 0
  },

  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt
});
