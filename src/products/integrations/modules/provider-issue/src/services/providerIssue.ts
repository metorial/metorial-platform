import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Prisma,
  type ProviderIssueSeverity,
  type ProviderIssueType,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  getRetentionCutoffDate,
  normalizeDateFilter,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { getProviderTenantFilter } from '@metorial-subspace/module-catalog';
import { searchRelatedEntities, whenRelatedMatched } from '@metorial-subspace/module-search';
import { type MetorialFacing, resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { subDays } from 'date-fns';

let OCCURRENCE_PERIOD_DAYS = 30;

let getInclude = (tenant: Tenant) => ({
  provider: true,
  protoGuardFilter: true,
  occurrencePeriods: {
    where: { startsAt: { gte: getOccurrencePeriodFloor(tenant) } },
    orderBy: { startsAt: 'asc' as const }
  }
});

class ProviderIssueServiceImpl {
  async listProviderIssues(
    d: MetorialFacing<{
      types?: ProviderIssueType[];
      severities?: ProviderIssueSeverity[];
      ids?: string[];
      providerIds?: string[];
      lastSeenAt?: DateFilter;
      createdAt?: DateFilter;
      search?: string;
    }>
  ) {
    let scope = await resolveMetorialFacing(d);

    let providers = await resolveProviders(scope, d.providerIds);
    let searchFilter = await this.buildSearchFilter({ ...scope, search: d.search });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerIssue.findMany({
            ...opts,
            where: {
              tenantOid: scope.tenant.oid,
              environmentOid: scope.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,
                d.severities ? { severity: { in: d.severities } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,

                searchFilter!,

                this.buildLastSeenFilter(scope.tenant, d.lastSeenAt),
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include: getInclude(scope.tenant)
          })
      )
    );
  }

  async getProviderIssueById(d: MetorialFacing<{ providerIssueId: string }>) {
    let scope = await resolveMetorialFacing(d);

    let issue = await db.providerIssue.findFirst({
      where: {
        id: d.providerIssueId,
        tenantOid: scope.tenant.oid,
        environmentOid: scope.environment.oid
      },
      include: getInclude(scope.tenant)
    });
    if (!issue) throw new ServiceError(notFoundError('provider.issue', d.providerIssueId));

    return issue;
  }

  // Issues outlive their occurrences, so the retention window applies to when an issue was last
  // seen rather than when it was first created.
  private buildLastSeenFilter(tenant: Tenant, filter?: DateFilter) {
    let floor = getRetentionCutoffDate(tenant.logRetentionInDays);
    let normalized = normalizeDateFilter(filter);

    return {
      lastSeenAt: {
        ...(normalized?.lt ? { lt: normalized.lt } : {}),
        gte: normalized?.gt && normalized.gt > floor ? normalized.gt : floor
      }
    };
  }

  private async buildSearchFilter(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;
    search?: string;
  }): Promise<Prisma.ProviderIssueWhereInput | undefined> {
    let search = d.search?.trim();
    if (!search) return undefined;

    let related = await searchRelatedEntities({
      tenant: d.tenant,
      query: search,
      kinds: ['providerOids'],
      providerFilter: getProviderTenantFilter({ ...d, includeDeprecated: true })
    });

    return {
      OR: [
        { id: search },
        { code: search },
        { subtype: search },
        { message: { contains: search, mode: 'insensitive' } },
        ...whenRelatedMatched(related.providerOids, oids => ({ providerOid: oids }))
      ]
    };
  }
}

let getOccurrencePeriodFloor = (tenant: Tenant) => {
  let retentionFloor = getRetentionCutoffDate(tenant.logRetentionInDays);
  let periodFloor = subDays(new Date(), OCCURRENCE_PERIOD_DAYS);

  return retentionFloor > periodFloor ? retentionFloor : periodFloor;
};

export let providerIssueService = Service.create(
  'providerIssueService',
  () => new ProviderIssueServiceImpl()
).build();
