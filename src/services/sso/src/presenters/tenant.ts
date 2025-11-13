import { Tenant } from '../db/schema';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'sso.tenant',

  id: tenant._id.toString(),

  status: tenant.status,

  name: tenant.name,
  metadata: tenant.metadata,
  externalId: tenant.externalId,

  clientId: tenant.clientId,

  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt
});
