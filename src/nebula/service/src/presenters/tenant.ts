import type { KeyProvider, Tenant } from '../../prisma/generated/client';

export let tenantPresenter = (tenant: Tenant & { defaultKeyProvider?: KeyProvider | null }) => ({
  object: 'nebula#tenant',
  id: tenant.id,
  identifier: tenant.identifier,
  name: tenant.name,
  keyReuseTimeSeconds: tenant.keyReuseTimeSeconds,
  defaultKeyProviderId: tenant.defaultKeyProvider?.id ?? null,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt
});
