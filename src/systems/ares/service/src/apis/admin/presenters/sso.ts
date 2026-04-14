import type {
  SsoConnection,
  SsoTenant,
  SsoTenantDomain
} from '../../../../prisma/generated/client';

export let ssoTenantPresenter = (
  tenant: SsoTenant & {
    _count?: { connections?: number };
    ssoTenantDomain?: SsoTenantDomain[];
  }
) => ({
  object: 'ares#ssoTenant' as const,

  id: tenant.id,
  name: tenant.name,
  status: tenant.status,
  clientId: tenant.clientId,
  externalId: tenant.externalId,
  isGlobal: tenant.isGlobal,

  counts: {
    connections: tenant._count?.connections ?? 0
  },

  domains: (tenant.ssoTenantDomain ?? []).map(domain => ({
    id: domain.id,
    domain: domain.domain,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt
  })),

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
