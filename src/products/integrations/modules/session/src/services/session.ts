import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  type Prisma,
  type Session,
  type SessionStatus,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import type { Instance, OrganizationActor } from '@metorial/db';
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
  resolveSessionProviders,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { getProviderTenantFilter } from '@metorial-subspace/module-catalog';
import { searchRelatedEntities, whenRelatedMatched } from '@metorial-subspace/module-search';
import {
  assertCanChangeOwnerLock,
  assertCanChangeOwnerOnlyVisibility,
  assertCanSeeOwnedResource,
  assertCanUseOwnedResource,
  canSeeOwnedResource,
  canUseOwnedResource,
  checkTenant,
  getMetorialSolution,
  getOwnershipAccessor,
  getOwnershipAccessorForFacing,
  type MetorialFacing,
  ownedResourceWhere,
  type OwnershipAccessor,
  type OwnershipFilter,
  resolveMetorialFacing,
  resolveOwnerActorOid,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { type AuditSubspaceSession, Fabric } from '@metorial/fabric';
import { rateLimitService } from '@metorial/module-rate-limit';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import {
  assertMagicMcpSessionMutable,
  enrichSession,
  enrichSessionEnsuringClientSecret,
  enrichSessions,
  finalizeSessionCreate
} from '../lib/sessionEnrichment';
import { sessionArchivedQueue } from '../queues/lifecycle/session';
import {
  createSessionRecord,
  resolveSessionRecordProviders,
  sessionInclude as include
} from './_shared/createSession';
import {
  assertInternalAdapterSupportedBySession,
  assertInternalSessionMutable,
  type InternalAdapterInput,
  resolveInternalAdapter
} from './_shared/internalAdapter';
import { type SessionProviderInput } from './sessionProviderInput';
import { assertNotPublicMcpOwned } from '@metorial-subspace/public-mcp-guard';

export { finalizeSessionCreate };

let assertCanWriteSession = (
  session: Pick<Session, 'ephemeralManagedSessionOid' | 'ownerPublicMcpServerOid'>,
  action: string
) => {
  assertNotPublicMcpOwned(session, 'session');

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
  includeInternal?: boolean;
  includeSystemOwned?: boolean;
  ownership?: OwnershipFilter;
  ownershipWhere?: Record<string, any>;

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

  search?: string;
  searchActorIds?: string[];
};

export type GetSessionByIdParams = {
  sessionId: string;
  allowDeleted?: boolean;
  includeSystemOwned?: boolean;
};

export type GetManySessionsByIdsParams = {
  ids: string[];
  allowDeleted?: boolean;
  includeSystemOwned?: boolean;
};

export type CreateSessionParams = {
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    isSystemOwned?: boolean;
    source?: 'explorer';
    isOwnerLocked?: boolean;
    isOwnerOnlyVisible?: boolean;

    providers: SessionProviderInput[];
  };
  ownerActorId?: string;
};

export type CreateInternalSessionParams = Omit<CreateSessionParams, 'ownerActorId'> & {
  adapter?: InternalAdapterInput;
  ownershipAccessor?: OwnershipAccessor;
  ownerActorOid?: bigint | null;
};

export type UpdateSessionParams = {
  session: Session;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    source?: 'explorer';
    isOwnerLocked?: boolean;
    isOwnerOnlyVisible?: boolean;
  };
  _allowMagicMcpUpdate?: boolean;
  _allowInternalUpdate?: boolean;
};

export type UpdateSessionFacingParams = Omit<UpdateSessionParams, 'session'> & {
  session: UpdateSessionParams['session'] & AuditSubspaceSession;
};

export type ArchiveSessionParams = {
  session: Session;
  _allowMagicMcpDelete?: boolean;
  _allowInternalDelete?: boolean;
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
      ownershipWhere: ownedResourceWhere(
        await getOwnershipAccessor({ tenant: scope.tenant, organizationActor }),
        { ownership: d.ownership ?? 'all', includeSystemOwned: d.includeSystemOwned }
      ),
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
    d: { tenant: Tenant; environment: Environment } & Omit<
      ListSessionsParams,
      'accessTagSessionIds'
    >
  ) {
    let solution = await getMetorialSolution();

    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let agents = await resolveAgents(ts, d.agentIds);
    let actors = await resolveIdentityActors(ts, d.actorIds);
    let sessionTemplates = await resolveSessionTemplates(ts, d.sessionTemplateIds);
    let sessionProviders = await resolveSessionProviders(ts, d.sessionProviderIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);

    let searchFilter = await this.buildSessionSearchFilter({ ...d, solution });

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
              ...(d.includeInternal ? {} : { isInternal: false }),
              ...(d.includeSystemOwned ? {} : { isSystemOwned: false }),

              AND: [
                d.ownershipWhere ?? undefined!,
                d.ids ? { id: { in: d.ids } } : undefined!,
                agents
                  ? {
                      connections: {
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
                      connections: {
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

                searchFilter!,

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

  async redactSessionsForCaller<
    T extends {
      clientSecret?: string | null;
      ownerActorOid: bigint | null;
      identityActorOid: bigint | null;
      isOwnerLocked: boolean;
      isOwnerOnlyVisible?: boolean;
      isSystemOwned?: boolean;
    }
  >(d: { instance: Instance; organizationActor?: OrganizationActor; sessions: T[] }) {
    let accessor = await getOwnershipAccessorForFacing(d);
    if (accessor.kind === 'internal') return d.sessions;

    return await Promise.all(
      d.sessions.map(async session =>
        (await canUseOwnedResource(accessor, session))
          ? session
          : { ...session, clientSecret: null }
      )
    );
  }

  async assertCanUseSessionForCaller(d: {
    instance: Instance;
    organizationActor?: OrganizationActor;
    session: {
      id: string;
      ownerActorOid: bigint | null;
      identityActorOid: bigint | null;
      isOwnerLocked: boolean;
      isOwnerOnlyVisible?: boolean;
      isSystemOwned?: boolean;
    };
  }) {
    let accessor = await getOwnershipAccessorForFacing(d);
    await assertCanUseOwnedResource(accessor, d.session, { resource: 'session' });
  }

  private async buildSessionSearchFilter(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;
    search?: string;
    searchActorIds?: string[];
  }): Promise<Prisma.SessionWhereInput | undefined> {
    let search = d.search?.trim();
    if (!search) return undefined;

    let ts = { tenant: d.tenant, environment: d.environment, solution: d.solution };

    let [related, searchActors] = await Promise.all([
      searchRelatedEntities({
        tenant: d.tenant,
        query: search,
        kinds: [
          'providerOids',
          'authMethodGlobalOids',
          'deploymentOids',
          'configOids',
          'authConfigOids',
          'agentOids',
          'actorOids',
          'identityOids'
        ],
        providerFilter: getProviderTenantFilter({ ...ts, includeDeprecated: true })
      }),
      resolveIdentityActors(ts, d.searchActorIds?.length ? d.searchActorIds : undefined)
    ]);

    let actorOids = [...related.actorOids, ...(searchActors?.oids ?? [])];

    let sessionProviderClauses: Prisma.SessionProviderWhereInput[] = [
      ...whenRelatedMatched(related.providerOids, oids => ({ providerOid: oids })),
      ...whenRelatedMatched(related.deploymentOids, oids => ({ deploymentOid: oids })),
      ...whenRelatedMatched(related.configOids, oids => ({ configOid: oids })),
      ...whenRelatedMatched(related.authConfigOids, oids => ({ authConfigOid: oids })),
      ...whenRelatedMatched(related.authMethodGlobalOids, oids => ({
        authConfig: { authMethod: { globalOid: oids } }
      }))
    ];

    return {
      OR: [
        { id: search },
        ...(sessionProviderClauses.length
          ? [{ providers: { some: { OR: sessionProviderClauses } } }]
          : []),
        ...whenRelatedMatched(related.agentOids, oids => ({
          connections: { some: { participant: { agentInstance: { agentOid: oids } } } }
        })),
        ...whenRelatedMatched(actorOids, oids => ({ identityActorOid: oids })),
        ...whenRelatedMatched(related.identityOids, oids => ({ identityOid: oids }))
      ]
    };
  }

  async getSessionById(d: MetorialFacing<GetSessionByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let session = await this.getSessionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    assertCanSeeOwnedResource(
      await getOwnershipAccessor({ tenant: scope.tenant, organizationActor }),
      session,
      { resource: 'session', id: d.sessionId }
    );

    return await enrichSessionEnsuringClientSecret({
      instance,
      session
    });
  }

  async getSessionByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionByIdParams
  ) {
    let solution = await getMetorialSolution();

    let session = await db.session.findFirst({
      where: {
        id: d.sessionId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,

        ...(d.includeSystemOwned ? {} : { isSystemOwned: false }),
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

    let allSessions = await this.getManySessionsByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    let accessor = await getOwnershipAccessor({ tenant: scope.tenant, organizationActor });
    let sessions = allSessions.filter(session => canSeeOwnedResource(accessor, session));

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
        ...(d.includeSystemOwned ? {} : { isSystemOwned: false }),
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
    await rateLimitService.consume({
      instance: d.instance,
      usages: [{ key: 'sessions.created' }]
    });

    let { ownerActorId, ...createRest } = rest;

    let session = await this.createSessionInternal({
      ...createRest,
      tenant: scope.tenant,
      environment: scope.environment,
      ownerActorOid: await resolveOwnerActorOid({
        tenant: scope.tenant,
        environment: scope.environment,
        ownerActorId
      }),
      ownershipAccessor: await getOwnershipAccessor({
        tenant: scope.tenant,
        organizationActor
      })
    });

    let enriched = await finalizeSessionCreate({
      instance,
      session
    });

    await Fabric.fire('provider.session.created:after', { ...eventBase, session });

    return enriched;
  }

  async createSessionInternal(
    d: { tenant: Tenant; environment: Environment } & CreateInternalSessionParams
  ) {
    let adapter = d.adapter
      ? await resolveInternalAdapter({
          tenant: d.tenant,
          environment: d.environment,
          adapter: d.adapter
        })
      : null;

    // Provider resolution can poll for versions and create default deployments/configs,
    // so it runs before the transaction instead of holding it open.
    let resolvedProviders = await resolveSessionRecordProviders({
      tenant: d.tenant,
      environment: d.environment,
      providers: d.input.providers,
      ownershipAccessor: d.ownershipAccessor
    });

    return withTransaction(async db => {
      let session = await createSessionRecord({
        tenant: d.tenant,
        environment: d.environment,
        input: d.input,
        resolvedProviders,
        owner: d.ownerActorOid
          ? {
              ownerActorOid: d.ownerActorOid,
              isOwnerLocked: !!resolvedProviders.template?.isOwnerLocked,
              isOwnerOnlyVisible: !!resolvedProviders.template?.isOwnerOnlyVisible
            }
          : undefined,
        inheritProviderOwner: !!d.ownershipAccessor?.isEnforced,
        isSystemOwned: d.input.isSystemOwned,
        isEphemeral: false,
        isInternal: !!adapter,
        adapterGlobalOid: adapter?.oid ?? null
      });

      if (adapter) {
        await assertInternalAdapterSupportedBySession({
          session,
          adapterGlobalOid: adapter.oid
        });
      }

      return session;
    });
  }

  async updateSession(d: MetorialFacing<UpdateSessionFacingParams>) {
    let { instance, organizationActor, _allowMagicMcpUpdate, ...rest } = d;

    await assertMagicMcpSessionMutable({
      sessionId: d.session.id,
      allow: _allowMagicMcpUpdate,
      action: 'updated'
    });

    let scope = await resolveMetorialFacing(d);
    let accessor = await getOwnershipAccessor({ tenant: scope.tenant, organizationActor });

    await assertCanUseOwnedResource(accessor, d.session, { resource: 'session' });

    await assertCanChangeOwnerLock(accessor, d.session, d.input.isOwnerLocked, {
      resource: 'session'
    });

    await assertCanChangeOwnerOnlyVisibility(accessor, d.session, d.input.isOwnerOnlyVisible, {
      resource: 'session'
    });

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session.updated:before', eventBase);

    let session = await this.updateSessionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session.updated:after', {
      ...eventBase,
      session,
      previousSession: d.session
    });

    return await enrichSessionEnsuringClientSecret({
      instance,
      session
    });
  }

  async updateSessionInternal(
    d: { tenant: Tenant; environment: Environment } & Omit<
      UpdateSessionParams,
      '_allowMagicMcpUpdate'
    >
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.session);
    checkDeletedEdit(d.session, 'update');
    assertCanWriteSession(d.session, 'update');
    assertInternalSessionMutable(d.session, 'update', d._allowInternalUpdate);

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
          privateMetadata: d.input.privateMetadata ?? d.session.privateMetadata,
          source: d.input.source,
          isOwnerLocked: d.input.isOwnerLocked,
          isOwnerOnlyVisible: d.input.isOwnerOnlyVisible
        },
        include
      });

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

    await assertCanUseOwnedResource(
      await getOwnershipAccessor({ tenant: scope.tenant, organizationActor }),
      d.session,
      { resource: 'session' }
    );

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
    d: { tenant: Tenant; environment: Environment } & Omit<
      ArchiveSessionParams,
      '_allowMagicMcpDelete'
    >
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.session);
    checkDeletedEdit(d.session, 'archive');
    assertCanWriteSession(d.session, 'archive');
    assertInternalSessionMutable(d.session, 'archive', d._allowInternalDelete);

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
    d: { tenant: Tenant; environment: Environment } & Omit<
      ArchiveSessionParams,
      '_allowMagicMcpDelete'
    >
  ) {
    return this.archiveSessionInternal(d);
  }
}

export let sessionService = Service.create('session', () => new sessionServiceImpl()).build();
