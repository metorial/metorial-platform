import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Session,
  type SessionProvider,
  type SessionProviderStatus,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessions,
  resolveSessionTemplates,
  type DateFilter
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import {
  sessionProviderInputService,
  type SessionProviderInput,
  type SessionProviderInputToolFilters
} from './sessionProviderInput';
import { sessionProviderNameTemplateService } from './sessionProviderNameTemplate';

let include = {
  provider: true,
  deployment: true,
  config: true,
  authConfig: true,
  session: true,
  fromTemplate: true,
  fromTemplateProvider: true
};
export let sessionProviderInclude = include;

export type ListSessionProvidersParams = {
  status?: SessionProviderStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  sessionIds?: string[];
  accessTagSessionIds?: string[];
  sessionTemplateIds?: string[];
  providerIds?: string[];
  providerDeploymentIds?: string[];
  providerConfigIds?: string[];
  providerAuthConfigIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetSessionProviderByIdParams = {
  sessionProviderId: string;
  allowDeleted?: boolean;
};

export type CreateSessionProviderParams = {
  session: Session;
  input: SessionProviderInput;
};

export type UpdateSessionProviderParams = {
  sessionProvider: SessionProvider;
  input: {
    toolFilters?: SessionProviderInputToolFilters;
  };
};

export type ArchiveSessionProviderParams = {
  sessionProvider: SessionProvider;
};

class sessionProviderServiceImpl {
  async listSessionProviders(d: MetorialFacing<ListSessionProvidersParams>) {
    let { instance, organizationActor, accessTagSessionIds, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionIds = narrowSessionIdFilter({
      allowedSessionIds: accessTagSessionIds,
      requestedSessionIds: rest.sessionIds
    });

    return this.listSessionProvidersInternal({
      ...rest,
      sessionIds,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listSessionProvidersInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<
      ListSessionProvidersParams,
      'accessTagSessionIds'
    >
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let sessions = await resolveSessions(ts, d.sessionIds);
    let sessionTemplates = await resolveSessionTemplates(ts, d.sessionTemplateIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionTemplates ? { fromTemplateOid: sessionTemplates.in } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                configs ? { configOid: configs.in } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionProviderById(d: MetorialFacing<GetSessionProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getSessionProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getSessionProviderByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionProviderByIdParams
  ) {
    let solution = await getMetorialSolution();

    let sessionProvider = await db.sessionProvider.findFirst({
      where: {
        id: d.sessionProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!sessionProvider)
      throw new ServiceError(notFoundError('sessionProvider', d.sessionProviderId));

    return await sessionProviderNameTemplateService.ensureForSessionProviderInternal({
      tenant: d.tenant,
      provider: sessionProvider
    });
  }

  async createSessionProvider(d: MetorialFacing<CreateSessionProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session.provider.created:before', eventBase);

    let sessionProvider = await this.createSessionProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session.provider.created:after', {
      ...eventBase,
      sessionProvider
    });

    return sessionProvider;
  }

  async createSessionProviderInternal(
    d: { tenant: Tenant; environment: Environment } & CreateSessionProviderParams
  ) {
    checkDeletedRelation(d.session);

    let [res] = await sessionProviderInputService.createSessionProvidersForInput({
      tenant: d.tenant,
      environment: d.environment,

      session: d.session,
      providers: [d.input]
    });

    return res!;
  }

  async updateSessionProvider(d: MetorialFacing<UpdateSessionProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session.provider.updated:before', eventBase);

    let sessionProvider = await this.updateSessionProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session.provider.updated:after', {
      ...eventBase,
      sessionProvider
    });

    return sessionProvider;
  }

  async updateSessionProviderInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateSessionProviderParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.sessionProvider);
    checkDeletedEdit(d.sessionProvider, 'update');

    return await db.sessionProvider.update({
      where: {
        oid: d.sessionProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid
      },
      data: {
        toolFilter: d.input.toolFilters ?? undefined
      },
      include
    });
  }

  async archiveSessionProvider(d: MetorialFacing<ArchiveSessionProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session.provider.deleted:before', eventBase);

    let sessionProvider = await this.archiveSessionProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session.provider.deleted:after', {
      ...eventBase,
      sessionProvider
    });

    return sessionProvider;
  }

  async archiveSessionProviderInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveSessionProviderParams
  ) {
    checkTenant(d, d.sessionProvider);
    checkDeletedEdit(d.sessionProvider, 'archive');

    return await db.sessionProvider.update({
      where: {
        oid: d.sessionProvider.oid
      },
      data: {
        status: 'archived' as const
      },
      include
    });
  }
}

export let sessionProviderService = Service.create(
  'sessionProvider',
  () => new sessionProviderServiceImpl()
).build();
