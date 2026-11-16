import type { SubRegistry, SubRegistryFilter, Tenant } from '../../prisma/generated/client';
import { subRegistryFilterPresenter } from './subRegistryFilter';

export let subRegistryPresenter = (
  subRegistry: SubRegistry & { tenant: Tenant; filters: SubRegistryFilter[] }
) => ({
  object: 'tenant.sub_registry' as const,

  id: subRegistry.id,

  identifier: subRegistry.identifier,
  name: subRegistry.name,

  tenantId: subRegistry.tenant.id,

  filters: subRegistry.filters.map(subRegistryFilterPresenter),

  createdAt: subRegistry.createdAt
});
