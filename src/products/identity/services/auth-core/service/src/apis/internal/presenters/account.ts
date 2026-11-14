import type {
  Account,
  AccountDomain,
  AccountDomainSsoConnection,
  AccountDomainSsoTenant,
  SsoConnection,
  SsoTenant
} from '../../../../prisma/generated/client';

export let accountPresenter = (
  account: Account & {
    ssoTenants?: SsoTenant[];
    accountDomains?: (AccountDomain & {
      allowedTenants?: (AccountDomainSsoTenant & { tenant: SsoTenant })[];
      allowedConnections?: (AccountDomainSsoConnection & {
        connection: SsoConnection;
      })[];
    })[];
    _count?: {
      users?: number;
      ssoTenants?: number;
      accountDomains?: number;
    };
  }
) => ({
  object: 'ares#account' as const,
  id: account.id,
  clientId: account.clientId,
  identifier: account.identifier,
  name: account.name,
  status: account.status,
  allowEmailLogin: account.allowEmailLogin,
  allowSocialLogin: account.allowSocialLogin,
  ssoTenants: (account.ssoTenants ?? []).map(tenant => ({
    object: 'ares#ssoTenant' as const,
    id: tenant.id,
    clientId: tenant.clientId,
    name: tenant.name,
    status: tenant.status
  })),
  domains: (account.accountDomains ?? []).map(domain => ({
    object: 'ares#accountDomain' as const,
    id: domain.id,
    domain: domain.domain,
    restrictions: [
      ...(domain.allowedTenants ?? []).map(link => ({
        type: 'tenant' as const,
        tenantId: link.tenant.id
      })),
      ...(domain.allowedConnections ?? []).map(link => ({
        type: 'connection' as const,
        connectionId: link.connection.id
      }))
    ],
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt
  })),
  counts: {
    users: account._count?.users ?? 0,
    ssoTenants: account._count?.ssoTenants ?? 0,
    domains: account._count?.accountDomains ?? 0
  },
  createdAt: account.createdAt,
  updatedAt: account.updatedAt
});
