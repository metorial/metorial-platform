import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  db,
  type Environment,
  type Session,
  type SessionProvider,
  type SessionProviderStatus,
  type Solution,
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
import { checkTenant } from '@metorial-subspace/module-tenant';
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

class sessionProviderServiceImpl {
  async listSessionProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: SessionProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionTemplateIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
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

  async getSessionProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionProviderId: string;

    allowDeleted?: boolean;
  }) {
    let sessionProvider = await db.sessionProvider.findFirst({
      where: {
        id: d.sessionProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!sessionProvider)
      throw new ServiceError(notFoundError('sessionProvider', d.sessionProviderId));

    return await sessionProviderNameTemplateService.ensureForSessionProvider(sessionProvider);
  }

  async createSessionProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    session: Session;
    input: SessionProviderInput;
  }) {
    checkDeletedRelation(d.session);

    let [res] = await sessionProviderInputService.createSessionProvidersForInput({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,

      session: d.session,
      providers: [d.input]
    });

    return res!;
  }

  async updateSessionProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionProvider: SessionProvider;
    input: {
      toolFilters?: SessionProviderInputToolFilters;
    };
  }) {
    checkTenant(d, d.sessionProvider);
    checkDeletedEdit(d.sessionProvider, 'update');

    return await db.sessionProvider.update({
      where: {
        oid: d.sessionProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      data: {
        toolFilter: d.input.toolFilters ?? undefined
      },
      include
    });
  }

  async archiveSessionProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionProvider: SessionProvider;
  }) {
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
