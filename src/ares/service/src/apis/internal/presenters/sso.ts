import type {
  SsoConnection,
  SsoTenant,
  SsoTenantDomain
} from '../../../../prisma/generated/client';

export let ssoTenantPresenter = (
  tenant: SsoTenant & {
    _count?: { connections?: number };
    ssoTenantDomain: SsoTenantDomain[];
  }
) => ({
  object: 'ares#ssoTenant' as const,

  id: tenant.id,
  name: tenant.name,
  status: tenant.status,
  clientId: tenant.clientId,
  externalId: tenant.externalId,
  isGlobal: tenant.isGlobal,
  hideInUI: tenant.hideInUI,

  counts: {
    connections: tenant._count?.connections ?? 0
  },

  domains: tenant.ssoTenantDomain.map(ssoTenantDomainPresenter),

  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt
});

export let ssoConnectionPresenter = (connection: SsoConnection) => ({
  object: 'ares#ssoConnection' as const,

  id: connection.id,
  name: connection.name,
  providerType: connection.providerType,
  providerName: connection.providerName,

  createdAt: connection.createdAt
});

export let ssoTenantDomainPresenter = (tenantDomain: SsoTenantDomain) => ({
  object: 'ares#ssoTenantDomain' as const,

  id: tenantDomain.id,
  domain: tenantDomain.domain,
  createdAt: tenantDomain.createdAt,
  updatedAt: tenantDomain.updatedAt
});
