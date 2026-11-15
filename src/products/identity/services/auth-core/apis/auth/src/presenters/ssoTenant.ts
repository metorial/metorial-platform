import type { SsoTenant } from '@mtsrc/auth-core-db';

export let ssoTenantPresenter = (tenant: SsoTenant) => ({
  object: 'ares#user.sso_tenant',

  name: tenant.name,
  id: tenant.id,
  status: tenant.status,
  clientId: tenant.clientId,
  externalId: tenant.externalId,
  metadata: tenant.metadata,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt
});
