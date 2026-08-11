import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type SessionErrorType,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  mergeRetentionWithDateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderRuns,
  resolveProviders,
  resolveSessionConnections,
  resolveSessionErrorGroups,
  resolveSessionMessages,
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
  group: true,
  providerRun: true,
  connection: true
};
export let sessionErrorInclude = include;

export type ListSessionErrorsParams = {
  types?: SessionErrorType[];
  allowDeleted?: boolean;

  ids?: string[];
  sessionIds?: string[];
  sessionProviderIds?: string[];
  sessionConnectionIds?: string[];
  providerRunIds?: string[];
  providerIds?: string[];
  sessionMessageIds?: string[];
  sessionErrorGroupIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetSessionErrorByIdParams = {
  sessionErrorId: string;
  allowDeleted?: boolean;
};

class sessionErrorServiceImpl {
  async listSessionErrors(d: MetorialFacing<ListSessionErrorsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listSessionErrorsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listSessionErrorsInternal(
    d: { tenant: Tenant; environment: Environment } & ListSessionErrorsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let sessions = await resolveSessions(ts, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(ts, d.sessionProviderIds);
    let connections = await resolveSessionConnections(ts, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(ts, d.providerRunIds);
    let messages = await resolveSessionMessages(ts, d.sessionMessageIds);
    let groups = await resolveSessionErrorGroups(ts, d.sessionErrorGroupIds);
    let providers = await resolveProviders(ts, d.providerIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionError.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,

                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionProviders
                  ? { providerRun: { sessionProviderOid: sessionProviders.in } }
                  : undefined!,
                connections ? { connectionOid: connections.in } : undefined!,
                providerRuns ? { providerRunOid: providerRuns.in } : undefined!,
                groups ? { groupOid: groups.in } : undefined!,
                messages ? { sessionMessages: { some: { oid: messages.in } } } : undefined!,
                providers ? { providerRun: { providerOid: providers.in } } : undefined!,

                mergeRetentionWithDateFilter(d.tenant, d.createdAt),
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionErrorById(d: MetorialFacing<GetSessionErrorByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getSessionErrorByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getSessionErrorByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionErrorByIdParams
  ) {
    let solution = await getMetorialSolution();

    let sessionError = await db.sessionError.findFirst({
      where: {
        id: d.sessionErrorId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent,
        ...mergeRetentionWithDateFilter(d.tenant)
      },
      include
    });
    if (!sessionError)
      throw new ServiceError(notFoundError('session.error', d.sessionErrorId));

    return sessionError;
  }
}

export let sessionErrorService = Service.create(
  'sessionError',
  () => new sessionErrorServiceImpl()
).build();
