import type {
  SsoConnection,
  SsoDirectory,
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
  status: connection.status,
  providerType: connection.providerType,
  providerName: connection.providerName,

  createdAt: connection.createdAt
});

export let ssoDirectoryPresenter = (directory: SsoDirectory) => ({
  object: 'ares#ssoDirectory' as const,

  id: directory.id,
  name: directory.name,
  type: directory.type,
  status: directory.status,
  scimPath: directory.scimPath,
  scimEndpoint: directory.scimEndpoint,
  scimSecret: directory.scimSecret,
  metadata: directory.metadata,

  createdAt: directory.createdAt,
  updatedAt: directory.updatedAt
});

export let ssoTenantDomainPresenter = (tenantDomain: SsoTenantDomain) => ({
  object: 'ares#ssoTenantDomain' as const,

  id: tenantDomain.id,
  domain: tenantDomain.domain,
  createdAt: tenantDomain.createdAt,
  updatedAt: tenantDomain.updatedAt
});
