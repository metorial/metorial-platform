import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  db,
  type Environment,
  type ProviderRunStatus,
  type Solution,
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

let include = {
  session: true,
  sessionProvider: true,
  provider: true,
  connection: true
};
export let providerRunInclude = include;

class providerRunServiceImpl {
  async listProviderRuns(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: ProviderRunStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    sessionConnectionIds?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let connections = await resolveSessionConnections(d, d.sessionConnectionIds);
    let providers = await resolveProviders(d, d.providerIds);
    let providerVersions = await resolveProviderVersions(d, d.providerVersionIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerRun.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              solutionOid: d.solution.oid,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
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

  async getProviderRunById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerRunId: string;
    allowDeleted?: boolean;
  }) {
    let providerRun = await db.providerRun.findFirst({
      where: {
        id: d.providerRunId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
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
