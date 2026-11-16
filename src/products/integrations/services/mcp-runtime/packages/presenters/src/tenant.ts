import type { Tenant } from '@mtsrc/mcp-runtime-db';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'shuttle#tenant',

  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,

  createdAt: tenant.createdAt
});
