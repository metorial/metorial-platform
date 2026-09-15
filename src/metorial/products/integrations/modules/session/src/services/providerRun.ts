import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type ProviderRunStatus,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  mergeRetentionWithDateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders,
  resolveProviderVersions,
  resolveSessionConnections,
  resolveSessionProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

let include = {
  session: true,
  sessionProvider: true,
  provider: true,
  connection: true
};
export let providerRunInclude = include;

export type ListProviderRunsParams = {
  status?: ProviderRunStatus[];
  allowDeleted?: boolean;
  includeInternal?: boolean;

  ids?: string[];
  sessionIds?: string[];
  sessionProviderIds?: string[];
  sessionConnectionIds?: string[];
  providerIds?: string[];
  providerVersionIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetProviderRunByIdParams = {
  providerRunId: string;
  allowDeleted?: boolean;
};

class providerRunServiceImpl {
  async listProviderRuns(d: MetorialFacing<ListProviderRunsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderRunsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderRunsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderRunsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let sessions = await resolveSessions(ts, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(ts, d.sessionProviderIds);
    let connections = await resolveSessionConnections(ts, d.sessionConnectionIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let providerVersions = await resolveProviderVersions(ts, d.providerVersionIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerRun.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              solutionOid: solution.oid,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
                !d.includeInternal && !d.sessionIds?.length
                  ? { session: { isInternal: false } }
                  : undefined!,
                d.ids ? { id: { in: d.ids } } : undefined!,

                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionProviders
                  ? { providerRun: { sessionProviderOid: sessionProviders.in } }
                  : undefined!,
                connections ? { connectionOid: connections.in } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                providerVersions ? { providerVersionOid: providerVersions.in } : undefined!,

                mergeRetentionWithDateFilter(d.tenant, d.createdAt),
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderRunById(d: MetorialFacing<GetProviderRunByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderRunByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderRunByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderRunByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerRun = await db.providerRun.findFirst({
      where: {
        id: d.providerRunId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent,
        ...mergeRetentionWithDateFilter(d.tenant)
      },
      include
    });
    if (!providerRun) throw new ServiceError(notFoundError('provider_run', d.providerRunId));

    return providerRun;
  }
}

export let providerRunService = Service.create(
  'providerRun',
  () => new providerRunServiceImpl()
).build();
