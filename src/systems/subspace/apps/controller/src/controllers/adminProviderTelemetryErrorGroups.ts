import { Paginator, type PaginatorInput } from '@lowerdeck/pagination';
import { db } from '@metorial-subspace/db';

export let adminProviderTelemetryErrorGroupTypes = [
  'message_processing_timeout',
  'message_processing_provider_error',
  'message_processing_system_error',
  'provider_discovery_failed'
] as const;

export type AdminProviderTelemetryErrorGroupType =
  (typeof adminProviderTelemetryErrorGroupTypes)[number];

export type AdminProviderTelemetryDateRange = {
  from?: Date;
  to?: Date;
};

export type AdminProviderTelemetryErrorGroupListInput = PaginatorInput & {
  providerId?: string;
  tenantId?: string;
  tenantIds?: string[];
  tenantSearch?: string;
  environmentId?: string;
  environmentIds?: string[];
  range?: AdminProviderTelemetryDateRange;
  types?: AdminProviderTelemetryErrorGroupType[];
};

let uniqueStrings = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.map(v => v?.trim()).filter(Boolean) as string[]));

let uniqueBigints = (values: bigint[]) => Array.from(new Set(values));

let oidFilter = (oids?: bigint[]) => (oids ? { in: oids } : undefined);

export let withDefaultProviderTelemetryRange = (range?: AdminProviderTelemetryDateRange) => {
  let to = range?.to ?? new Date();
  let from = range?.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  let maxRangeMs = 90 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    from = new Date(to.getTime() - maxRangeMs);
  }

  return { from, to };
};

let createdAtOrder = (order?: 'asc' | 'desc') => [
  { createdAt: order ?? ('desc' as const) },
  { id: order ?? ('desc' as const) }
];

let emptyPaginator = () => Paginator.create(({ prisma }) => prisma(async () => []));

let resolveProvider = async (providerId?: string) => {
  if (!providerId) return undefined;

  return await db.provider.findFirstOrThrow({
    where: {
      OR: [
        { id: providerId },
        { slug: providerId },
        { globalIdentifier: providerId },
        { listing: { id: providerId } },
        { listing: { slug: providerId } }
      ]
    }
  });
};

export let resolveAdminProviderTelemetryScope = async (input: {
  providerId?: string;
  tenantId?: string;
  tenantIds?: string[];
  tenantSearch?: string;
  environmentId?: string;
  environmentIds?: string[];
  range?: AdminProviderTelemetryDateRange;
}) => {
  let { from, to } = withDefaultProviderTelemetryRange(input.range);
  let provider = await resolveProvider(input.providerId);
  let tenantIds = uniqueStrings([input.tenantId, ...(input.tenantIds ?? [])]);
  let tenantSearch = input.tenantSearch?.trim();
  let environmentIds = uniqueStrings([input.environmentId, ...(input.environmentIds ?? [])]);

  if (
    (input.tenantIds && tenantIds.length === 0) ||
    (input.environmentIds && environmentIds.length === 0)
  ) {
    return { provider, from, to, isEmpty: true as const };
  }

  let tenants = tenantIds.length
    ? await db.tenant.findMany({ where: { id: { in: tenantIds } } })
    : [];
  if (tenantIds.length && tenants.length !== tenantIds.length) {
    throw new Error('One or more tenant IDs were not found');
  }

  let tenantSearchMatches = tenantSearch
    ? await db.tenant.findMany({
        where: {
          OR: [
            { id: { contains: tenantSearch, mode: 'insensitive' } },
            { identifier: { contains: tenantSearch, mode: 'insensitive' } },
            { urlKey: { contains: tenantSearch, mode: 'insensitive' } },
            { name: { contains: tenantSearch, mode: 'insensitive' } }
          ]
        }
      })
    : [];

  if (tenantSearch && tenantSearchMatches.length === 0 && tenantIds.length === 0) {
    return { provider, from, to, isEmpty: true as const };
  }

  let tenantOids = uniqueBigints(
    [...tenants, ...tenantSearchMatches].map(tenant => tenant.oid)
  );
  let environments = environmentIds.length
    ? await db.environment.findMany({
        where: {
          id: { in: environmentIds },
          tenantOid: tenantOids.length ? { in: tenantOids } : undefined
        }
      })
    : [];
  if (environmentIds.length && environments.length !== environmentIds.length) {
    throw new Error('One or more environment IDs were not found');
  }

  return {
    provider,
    from,
    to,
    tenantOids: tenantOids.length ? tenantOids : undefined,
    environmentOids: environments.length
      ? environments.map(environment => environment.oid)
      : undefined,
    isEmpty: false as const
  };
};

export let createAdminProviderTelemetryErrorGroupsPaginator = async (
  input: AdminProviderTelemetryErrorGroupListInput
) => {
  let scope = await resolveAdminProviderTelemetryScope(input);
  if (scope.isEmpty) return emptyPaginator();

  return Paginator.create(
    ({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionErrorGroup.findMany({
            ...opts,
            orderBy: createdAtOrder(input.order),
            where: {
              providerOid: scope.provider?.oid,
              tenantOid: oidFilter(scope.tenantOids),
              environmentOid: oidFilter(scope.environmentOids),
              type: input.types ? { in: input.types } : undefined,
              instances: {
                some: {
                  createdAt: { gte: scope.from, lte: scope.to }
                }
              }
            },
            include: {
              provider: true,
              tenant: true,
              environment: true,
              firstOccurrence: {
                include: {
                  session: true,
                  providerRun: true
                }
              },
              sessionErrorGroupOccurrencePeriods: {
                where: { startsAt: { lte: scope.to }, endsAt: { gte: scope.from } },
                orderBy: { startsAt: 'asc' }
              }
            }
          })
      ),
    { defaultOrder: 'desc' }
  );
};
