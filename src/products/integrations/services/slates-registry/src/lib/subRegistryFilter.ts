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

// Directly uploaded slates (local development) stay visible; mirrored ones need activation.
let activatedSlateClause: Prisma.SlateWhereInput = {
  OR: [{ activation: { isNot: null } }, { slateVersions: { some: { origin: 'upload' } } }]
};

export let buildSlateFilterClause = (
  subRegistry: SubRegistryWithFilters | null | undefined,
  tenantOid?: bigint
): Prisma.SlateWhereInput => {
  let tenantAccessClause: Prisma.SlateWhereInput = tenantOid
    ? { OR: [{ tenantOid }, { access: 'public' }] }
    : { access: 'public' };
  let baseAccessClause: Prisma.SlateWhereInput = subRegistry?.onlyActivated
    ? { AND: [tenantAccessClause, activatedSlateClause] }
    : tenantAccessClause;
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
  let tenantAccessClause: Prisma.ChangeNotificationWhereInput = tenantOid
    ? { OR: [{ tenantOid }, { slate: { access: 'public' } }] }
    : { slate: { access: 'public' } };
  let baseAccessClause: Prisma.ChangeNotificationWhereInput = subRegistry?.onlyActivated
    ? { AND: [tenantAccessClause, { slate: activatedSlateClause }] }
    : tenantAccessClause;

  if (!subRegistry || subRegistry.filters.length === 0) return baseAccessClause;

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

  return {
    AND: [baseAccessClause, { OR: filterConditions }]
  };
};
