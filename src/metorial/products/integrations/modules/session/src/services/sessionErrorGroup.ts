import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Prisma,
  type SessionErrorType,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  mergeRetentionWithDateFilter,
  normalizeDateFilter,
  resolveProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { getProviderTenantFilter } from '@metorial-subspace/module-catalog';
import { searchRelatedEntities, whenRelatedMatched } from '@metorial-subspace/module-search';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

let include = {
  provider: true,
  firstOccurrence: true
};

export type ListSessionErrorGroupsParams = {
  types?: SessionErrorType[];
  includeInternal?: boolean;

  ids?: string[];
  sessionIds?: string[];
  providerIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;

  search?: string;
};

export type GetSessionErrorGroupByIdParams = {
  sessionErrorGroupId: string;
  allowDeleted?: boolean;
};

class sessionErrorGroupServiceImpl {
  async listSessionErrorGroups(d: MetorialFacing<ListSessionErrorGroupsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listSessionErrorGroupsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listSessionErrorGroupsInternal(
    d: { tenant: Tenant; environment: Environment } & ListSessionErrorGroupsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let sessions = await resolveSessions(ts, d.sessionIds);
    let providers = await resolveProviders(ts, d.providerIds);

    let searchFilter = await this.buildSessionErrorGroupSearchFilter({ ...d, solution });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionErrorGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,

              AND: [
                !d.includeInternal && !d.sessionIds?.length
                  ? { instances: { some: { session: { isInternal: false } } } }
                  : undefined!,
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,

                sessions ? { instances: { some: { sessionOid: sessions.in } } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,

                searchFilter!,

                mergeRetentionWithDateFilter(d.tenant, d.createdAt),
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  private async buildSessionErrorGroupSearchFilter(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;
    search?: string;
  }): Promise<Prisma.SessionErrorGroupWhereInput | undefined> {
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
        ...whenRelatedMatched(related.providerOids, oids => ({ providerOid: oids }))
      ]
    };
  }

  async getSessionErrorGroupById(d: MetorialFacing<GetSessionErrorGroupByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getSessionErrorGroupByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getSessionErrorGroupByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionErrorGroupByIdParams
  ) {
    let sessionErrorGroup = await db.sessionErrorGroup.findFirst({
      where: {
        id: d.sessionErrorGroupId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        ...mergeRetentionWithDateFilter(d.tenant)
      },
      include
    });
    if (!sessionErrorGroup)
      throw new ServiceError(notFoundError('session.error_group', d.sessionErrorGroupId));

    return sessionErrorGroup;
  }
}

export let sessionErrorGroupService = Service.create(
  'sessionErrorGroup',
  () => new sessionErrorGroupServiceImpl()
).build();
