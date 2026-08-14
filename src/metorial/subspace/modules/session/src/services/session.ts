import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  type Session,
  type SessionStatus,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  getSessionRetentionFilter,
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
  assertMagicMcpSessionMutable,
  enrichSession,
  enrichSessionEnsuringClientSecret,
  enrichSessions,
  finalizeSessionCreate
} from '../lib/sessionEnrichment';
import { sessionArchivedQueue, sessionUpdatedQueue } from '../queues/lifecycle/session';
import { createSessionRecord, sessionInclude as include } from './_shared/createSession';
import { type SessionProviderInput } from './sessionProviderInput';

export { finalizeSessionCreate };

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

export type ListSessionsParams = {
  status?: SessionStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  accessTagSessionIds?: string[];
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
};

export type GetSessionByIdParams = {
  sessionId: string;
  allowDeleted?: boolean;
};

export type GetManySessionsByIdsParams = {
  ids: string[];
  allowDeleted?: boolean;
};

export type CreateSessionParams = {
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;

    providers: SessionProviderInput[];
  };
};

export type UpdateSessionParams = {
  session: Session;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  };
  _allowMagicMcpUpdate?: boolean;
};

export type ArchiveSessionParams = {
  session: Session;
  _allowMagicMcpDelete?: boolean;
};

class sessionServiceImpl {
  async listSessions(d: MetorialFacing<ListSessionsParams>) {
    let { instance, organizationActor, accessTagSessionIds, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let ids = narrowSessionIdFilter({
      allowedSessionIds: accessTagSessionIds,
      requestedSessionIds: rest.ids
    });

    let paginator = await this.listSessionsInternal({
      ...rest,
      ids,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return paginator.mapAll(sessions =>
      enrichSessions({
        instance,
        sessions
      })
    );
  }

  async listSessionsInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<ListSessionsParams, 'accessTagSessionIds'>
  ) {
    let solution = await getMetorialSolution();

    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let agents = await resolveAgents(ts, d.agentIds);
    let actors = await resolveIdentityActors(ts, d.actorIds);
    let sessionTemplates = await resolveSessionTemplates(ts, d.sessionTemplateIds);
    let sessionProviders = await resolveProviders(ts, d.sessionProviderIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.session.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              // isEphemeral: false,

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

                getSessionRetentionFilter(d.tenant, d.createdAt)!,
                !d.tenant.enforceSessionExpiry && d.createdAt
                  ? { createdAt: normalizeDateFilter(d.createdAt) }
                  : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionById(d: MetorialFacing<GetSessionByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let session = await this.getSessionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return await enrichSessionEnsuringClientSecret({
      instance,
      session
    });
  }

  async getSessionByIdInternal(d: { tenant: Tenant; environment: Environment } & GetSessionByIdParams) {
    let solution = await getMetorialSolution();

    let session = await db.session.findFirst({
      where: {
        id: d.sessionId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,

        ...normalizeStatusForGet(d).noParent,
        ...getSessionRetentionFilter(d.tenant)
      },
      include
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionId));

    return session;
  }

  async getManySessionsByIds(d: MetorialFacing<GetManySessionsByIdsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessions = await this.getManySessionsByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return await enrichSessions({
      instance,
      sessions
    });
  }

  async getManySessionsByIdsInternal(
    d: { tenant: Tenant; environment: Environment } & GetManySessionsByIdsParams
  ) {
    let solution = await getMetorialSolution();

    return await db.session.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent,
        ...getSessionRetentionFilter(d.tenant)
      },
      include
    });
  }

  async createSession(d: MetorialFacing<CreateSessionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session.created:before', eventBase);

    let session = await this.createSessionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    let enriched = await finalizeSessionCreate({
      instance,
      session
    });

    await Fabric.fire('provider.session.created:after', { ...eventBase, session });

    return enriched;
  }

  async createSessionInternal(d: { tenant: Tenant; environment: Environment } & CreateSessionParams) {
    return withTransaction(async db =>
      createSessionRecord({
        tenant: d.tenant,
        environment: d.environment,
        input: d.input,
        isEphemeral: false
      })
    );
  }

  async updateSession(d: MetorialFacing<UpdateSessionParams>) {
    let { instance, organizationActor, _allowMagicMcpUpdate, ...rest } = d;

    await assertMagicMcpSessionMutable({
      sessionId: d.session.id,
      allow: _allowMagicMcpUpdate,
      action: 'updated'
    });

    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session.updated:before', eventBase);

    let session = await this.updateSessionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session.updated:after', { ...eventBase, session });

    return await enrichSessionEnsuringClientSecret({
      instance,
      session
    });
  }

  async updateSessionInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<UpdateSessionParams, '_allowMagicMcpUpdate'>
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.session);
    checkDeletedEdit(d.session, 'update');
    assertCanWriteSession(d.session, 'update');

    return withTransaction(async db => {
      let session = await db.session.update({
        where: {
          oid: d.session.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
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

  async archiveSession(d: MetorialFacing<ArchiveSessionParams>) {
    let { instance, organizationActor, _allowMagicMcpDelete, ...rest } = d;

    await assertMagicMcpSessionMutable({
      sessionId: d.session.id,
      allow: _allowMagicMcpDelete,
      action: 'deleted'
    });

    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session.deleted:before', eventBase);

    let session = await this.archiveSessionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session.deleted:after', { ...eventBase, session });

    return await enrichSession({
      instance,
      session
    });
  }

  async archiveSessionInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<ArchiveSessionParams, '_allowMagicMcpDelete'>
  ) {
    let solution = await getMetorialSolution();

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
          solutionOid: solution.oid,
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

  async deleteSession(d: MetorialFacing<ArchiveSessionParams>) {
    return this.archiveSession(d);
  }

  async deleteSessionInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<ArchiveSessionParams, '_allowMagicMcpDelete'>
  ) {
    return this.archiveSessionInternal(d);
  }
}

export let sessionService = Service.create('session', () => new sessionServiceImpl()).build();
