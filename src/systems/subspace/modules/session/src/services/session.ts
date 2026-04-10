import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Session,
  type SessionStatus,
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
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  sessionArchivedQueue,
  sessionCreatedQueue,
  sessionDeletedQueue,
  sessionUpdatedQueue
} from '../queues/lifecycle/session';
import { sessionProviderInclude } from './sessionProvider';
import {
  type SessionProviderInput,
  sessionProviderInputService
} from './sessionProviderInput';

let include = {
  providers: {
    include: sessionProviderInclude,
    where: { status: 'active' as const }
  }
};

class sessionServiceImpl {
  async listSessions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: SessionStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionTemplateIds?: string[];
    sessionProviderIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);
    let sessionProviders = await resolveProviders(d, d.sessionProviderIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.session.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              isEphemeral: false,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                sessionTemplates
                  ? { providers: { some: { fromTemplateOid: sessionTemplates.in } } }
                  : undefined!,

                sessionProviders
                  ? { providers: { some: { oid: sessionProviders.in } } }
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

  async getSessionById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionId: string;
    allowDeleted?: boolean;
  }) {
    let session = await db.session.findFirst({
      where: {
        id: d.sessionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionId));

    return session;
  }

  async getManySessionsByIds(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids: string[];
    allowDeleted?: boolean;
  }) {
    return await db.session.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForList(d).noParent
      },
      include
    });
  }

  async createSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;

      providers: SessionProviderInput[];
    };
  }) {
    return withTransaction(async db => {
      let session = await db.session.create({
        data: {
          ...getId('session'),
          status: 'active',

          isEphemeral: false,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,

          sessionEvents: {
            create: {
              ...getId('sessionEvent'),
              type: 'session_created',
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid
            }
          }
        },
        include
      });

      session.providers = await sessionProviderInputService.createSessionProvidersForInput({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        session,

        providers: d.input.providers
      });

      await addAfterTransactionHook(async () =>
        sessionCreatedQueue.add({ sessionId: session.id })
      );

      return session;
    });
  }

  async updateSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    session: Session;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.session);
    checkDeletedEdit(d.session, 'update');

    return withTransaction(async db => {
      let session = await db.session.update({
        where: {
          oid: d.session.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.session.name,
          description: d.input.description ?? d.session.description,
          metadata: d.input.metadata ?? d.session.metadata,
          privateMetadata: d.input.privateMetadata ?? d.session.privateMetadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        sessionUpdatedQueue.add({ sessionId: session.id })
      );

      return session;
    });
  }

  async archiveSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    session: Session;
  }) {
    checkTenant(d, d.session);
    checkDeletedEdit(d.session, 'archive');

    return withTransaction(async db => {
      let archivedAt = new Date();

      await db.sessionProvider.updateMany({
        where: {
          sessionOid: d.session.oid
        },
        data: {
          status: 'archived' as const
        }
      });

      let session = await db.session.update({
        where: {
          oid: d.session.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: { status: 'archived', archivedAt, connectionState: 'disconnected' },
        include
      });

      await addAfterTransactionHook(async () =>
        sessionArchivedQueue.add({ sessionId: session.id })
      );

      return session;
    });
  }

  async deleteSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    session: Session;
  }) {
    return this.archiveSession(d);
  }
}

export let sessionService = Service.create('session', () => new sessionServiceImpl()).build();
