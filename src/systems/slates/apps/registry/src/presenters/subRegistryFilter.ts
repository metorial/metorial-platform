import type { SubRegistryFilter } from '../../prisma/generated/client';

export let subRegistryFilterPresenter = (filter: SubRegistryFilter) => ({
  object: 'sub_registry.filter' as const,
  id: filter.id,
  type: filter.type,
  value: filter.value,
  createdAt: filter.createdAt
});
