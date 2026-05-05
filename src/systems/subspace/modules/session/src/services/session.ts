import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
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
  resolveAgents,
  resolveIdentityActors,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { sessionArchivedQueue, sessionUpdatedQueue } from '../queues/lifecycle/session';
import { createSessionRecord, sessionInclude as include } from './_shared/createSession';
import { type SessionProviderInput } from './sessionProviderInput';

let assertCanWriteSession = (
  session: Pick<Session, 'ephemeralManagedSessionOid'>,
  action: string
) => {
  if (!session.ephemeralManagedSessionOid) {
    return;
  }

  throw new ServiceError(
    badRequestError({
      message: `Cannot ${action} a session that is managed by Metorial.`,
      code: 'session_is_metorial_managed'
    })
  );
};

class sessionServiceImpl {
  async listSessions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: SessionStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    agentIds?: string[];
    actorIds?: string[];
    sessionTemplateIds?: string[];
    sessionProviderIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let agents = await resolveAgents(d, d.agentIds);
    let actors = await resolveIdentityActors(d, d.actorIds);
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
                agents
                  ? {
                      sessionConnections: {
                        some: {
                          participant: {
                            agentInstance: { agentOid: agents.in }
                          }
                        }
                      }
                    }
                  : undefined!,
                actors
                  ? {
                      sessionConnections: {
                        some: {
                          participant: {
                            agentInstance: { agent: { actorOid: actors.in } }
                          }
                        }
                      }
                    }
                  : undefined!,

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
        ...normalizeStatusForGet(d).noParent
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
    return withTransaction(async db =>
      createSessionRecord({
        db,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        input: d.input,
        isEphemeral: false
      })
    );
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
    assertCanWriteSession(d.session, 'update');

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
    assertCanWriteSession(d.session, 'archive');

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
