import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type SessionProviderStatus,
  type SessionTemplate,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { providerToolService } from '@metorial-subspace/module-catalog';
import { checkToolAccess } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { sessionTemplateArchivedQueue } from '../queues/lifecycle/sessionTemplate';
import {
  type SessionProviderInput,
  sessionProviderInputService
} from './sessionProviderInput';
import { sessionTemplateProviderInclude } from './sessionTemplateProvider';

let include = {
  providers: {
    include: sessionTemplateProviderInclude,
    where: { status: 'active' as const }
  }
};

class sessionTemplateServiceImpl {
  async listSessionTemplates(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: SessionProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveProviders(d, d.sessionProviderIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionTemplate.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              isInternal: false,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                sessions
                  ? { sessionProviders: { some: { sessionOid: sessions.in } } }
                  : undefined!,
                sessionProviders
                  ? { sessionProviders: { some: { providerOid: sessionProviders.in } } }
                  : undefined!,

                providers
                  ? { providers: { some: { providerOid: providers.in } } }
                  : undefined!,
                deployments
                  ? { providers: { some: { deploymentOid: deployments.in } } }
                  : undefined!,
                configs ? { providers: { some: { configOid: configs.in } } } : undefined!,
                authConfigs
                  ? { providers: { some: { authConfigOid: authConfigs.in } } }
                  : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionTemplateById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplateId: string;
    allowDeleted?: boolean;
  }) {
    let session = await db.sessionTemplate.findFirst({
      where: {
        id: d.sessionTemplateId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!session)
      throw new ServiceError(notFoundError('session.template', d.sessionTemplateId));

    return session;
  }

  async getManySessionTemplatesByIds(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids: string[];
    allowDeleted?: boolean;
  }) {
    return await db.sessionTemplate.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
  }

  async createSessionTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      isInternal?: boolean;
      providers: SessionProviderInput[];
    };
  }) {
    return withTransaction(async db => {
      let template = await db.sessionTemplate.create({
        data: {
          ...getId('sessionTemplate'),
          status: 'active',

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,

          isInternal: !!d.input.isInternal,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include
      });

      template.providers =
        await sessionProviderInputService.createSessionTemplateProvidersForInput({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          template,

          providers: d.input.providers
        });

      return template;
    });
  }

  async updateSessionTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    template: SessionTemplate;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.template);
    checkDeletedEdit(d.template, 'update');

    return withTransaction(async db => {
      let template = await db.sessionTemplate.update({
        where: {
          oid: d.template.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata
        },
        include
      });

      return template;
    });
  }

  async archiveSessionTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplate: SessionTemplate;
  }) {
    checkTenant(d, d.sessionTemplate);
    checkDeletedEdit(d.sessionTemplate, 'archive');

    return withTransaction(async db => {
      let archivedAt = new Date();

      await db.sessionTemplateProvider.updateMany({
        where: {
          sessionTemplateOid: d.sessionTemplate.oid
        },
        data: {
          status: 'archived' as const
        }
      });

      let sessionTemplate = await db.sessionTemplate.update({
        where: {
          oid: d.sessionTemplate.oid
        },
        data: {
          status: 'archived' as const,
          archivedAt
        },
        include
      });

      await addAfterTransactionHook(async () =>
        sessionTemplateArchivedQueue.add({
          sessionTemplateId: sessionTemplate.id
        })
      );

      return sessionTemplate;
    });
  }

  async deleteSessionTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplate: SessionTemplate;
  }) {
    return this.archiveSessionTemplate(d);
  }

  async listSessionTemplateTools(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplateId: string;
  }) {
    let sessionTemplate = await this.getSessionTemplateById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      sessionTemplateId: d.sessionTemplateId
    });

    let toolMap = new Map<string, any>();

    for (let templateProvider of sessionTemplate.providers) {
      let currentVersion = await db.providerVersion.findFirst({
        where: {
          providerOid: templateProvider.providerOid,
          isCurrent: true
        }
      });
      if (!currentVersion) continue;

      let paginator = await providerToolService.listProviderTools({
        solution: d.solution,
        tenant: d.tenant,
        environment: d.environment,
        providerVersion: currentVersion
      });

      let list = await paginator.run({ limit: 100 });

      for (let tool of list.items) {
        if (toolMap.has(tool.key)) continue;

        let { allowed } = checkToolAccess(tool, templateProvider, 'list');
        if (allowed) toolMap.set(tool.key, tool);
      }
    }

    return Array.from(toolMap.values());
  }
}

export let sessionTemplateService = Service.create(
  'session',
  () => new sessionTemplateServiceImpl()
).build();
