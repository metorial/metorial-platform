import type { Registry, Tenant } from '../../prisma/generated/client';
import { tenantPresenter } from './tenant';

export let registryPresenter = (registry: Registry & { tenant: Tenant | null }) => ({
  object: 'registry',

  id: registry.id,
  status: registry.status,

  isPredefined: registry.isPredefined,

  identifier: registry.identifier,
  name: registry.name,
  url: registry.url,

  tenant: registry.tenant ? tenantPresenter(registry.tenant) : null,

  createdAt: registry.createdAt,
  lastSyncedAt: registry.lastSyncedAt
});
