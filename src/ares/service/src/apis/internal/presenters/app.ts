import type { App, Tenant } from '../../../../prisma/generated/client';

export let appPresenter = (
  app: App & {
    defaultTenant: Tenant | null;
    _count?: { users?: number; tenants?: number };
  }
) => ({
  object: 'ares#app' as const,

  id: app.id,
  clientId: app.clientId,
  slug: app.slug,

  hasTerms: app.hasTerms,
  isSessionless: app.isSessionless,
  disableEmailAuth: app.disableEmailAuth,
  defaultRedirectUrl: app.defaultRedirectUrl,
  redirectDomains: app.redirectDomains,

  defaultTenant: app.defaultTenant
    ? {
        id: app.defaultTenant.id,
        clientId: app.defaultTenant.clientId
      }
    : null,

  counts: {
    users: app._count?.users ?? 0,
    tenants: app._count?.tenants ?? 0
  },

  createdAt: app.createdAt,
  updatedAt: app.updatedAt
});
