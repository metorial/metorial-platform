import type {
  Prisma,
  SubRegistry,
  SubRegistryFilter,
  Tenant
} from '../../prisma/generated/client';

export type SubRegistryWithFilters = SubRegistry & {
  filters: SubRegistryFilter[];
  tenant: Tenant;
};

export let buildSlateFilterClause = (
  subRegistry: SubRegistryWithFilters | null | undefined,
  tenantOid?: bigint
): Prisma.SlateWhereInput => {
  let baseAccessClause: Prisma.SlateWhereInput = tenantOid
    ? { OR: [{ tenantOid }, { access: 'public' }] }
    : { access: 'public' };
  if (!subRegistry || subRegistry.filters.length === 0) return baseAccessClause;

  let filterConditions: Prisma.SlateWhereInput[] = [];

  for (let filter of subRegistry.filters) {
    switch (filter.type) {
      case 'scope':
        filterConditions.push({
          scope: { OR: [{ id: filter.value }, { identifier: filter.value }] }
        });
        break;

      case 'prefix':
        filterConditions.push({
          fullIdentifier: { startsWith: filter.value }
        });
        break;

      case 'package':
        filterConditions.push({
          fullIdentifier: filter.value
        });
        break;
    }
  }

  return {
    AND: [baseAccessClause, { OR: filterConditions }]
  };
};

export let buildChangeNotificationFilterClause = (
  subRegistry: SubRegistryWithFilters | null | undefined,
  tenantOid?: bigint
): Prisma.ChangeNotificationWhereInput => {
  let baseClause = { tenantOid };
  if (!subRegistry || subRegistry.filters.length === 0) return baseClause;

  let filterConditions: Prisma.ChangeNotificationWhereInput[] = [];

  for (let filter of subRegistry.filters) {
    switch (filter.type) {
      case 'scope':
        filterConditions.push({
          slate: { scope: { OR: [{ id: filter.value }, { identifier: filter.value }] } }
        });
        break;

      case 'prefix':
        filterConditions.push({
          slateFullIdentifier: { startsWith: filter.value }
        });
        break;

      case 'package':
        filterConditions.push({
          slateFullIdentifier: filter.value
        });
        break;
    }
  }

  return { OR: filterConditions };
};
