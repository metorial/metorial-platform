import type {
  SsoConnection,
  SsoDirectory,
  SsoTenant
} from '../../../../prisma/generated/client';

export let ssoTenantPresenter = (
  tenant: SsoTenant & {
    _count?: { connections?: number };
    account?: {
      id: string;
      clientId: string;
      identifier: string;
      name: string;
    } | null;
  }
) => ({
  object: 'ares#ssoTenant' as const,

  id: tenant.id,
  name: tenant.name,
  status: tenant.status,
  clientId: tenant.clientId,
  externalId: tenant.externalId,
  enrollment: tenant.enrollment,
  account: tenant.account
    ? {
        id: tenant.account.id,
        clientId: tenant.account.clientId,
        identifier: tenant.account.identifier,
        name: tenant.account.name
      }
    : null,

  counts: {
    connections: tenant._count?.connections ?? 0
  },

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
