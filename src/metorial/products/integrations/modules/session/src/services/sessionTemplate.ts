import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type IntegrationInstance,
  type IntegrationInstanceGroup,
  Prisma,
  type SessionTemplate,
  type SessionTemplateStatus,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  isRecordDeleted,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIntegrationInstanceGroupProviders,
  resolveIntegrationInstanceGroups,
  resolveIntegrationInstanceProviders,
  resolveIntegrationInstances,
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { providerToolService } from '@metorial-subspace/module-catalog';
import { checkToolAccess } from '@metorial-subspace/module-provider-internal';
import {
  assertCanChangeOwnerOnlyVisibility,
  assertCanSeeOwnedResource,
  canSeeOwnedResource,
  checkTenant,
  getMetorialSolution,
  getOwnershipAccessor,
  type MetorialFacing,
  ownedResourceWhere,
  type OwnershipAccessor,
  type OwnershipFilter,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric, type AuditSubspaceSessionTemplate } from '@metorial/fabric';
import { metorialDb, ownerActorSelect } from '@metorial-subspace/module-tenant';
import { sessionTemplateArchivedQueue } from '../queues/lifecycle/sessionTemplate';
import { queueJobId, withSessionTemplateSyncLock } from '../lib/sessionTemplateSync';
import {
  type SessionProviderInput,
  sessionProviderInputService
} from './sessionProviderInput';
import { sessionTemplateProviderInclude } from './sessionTemplateProvider';

let assertMagicMcpSessionTemplateMutable = async (d: {
  sessionTemplateId: string;
  allow?: boolean;
  action: 'updated' | 'deleted';
}) => {
  if (d.allow) return;

  let [magicMcpLink1, magicMcpLink2, magicMcpLink3] = await Promise.all([
    metorialDb.magicMcpSession.findFirst({
      where: { subspaceSessionTemplateId: d.sessionTemplateId }
    }),
    metorialDb.magicMcpServer.findFirst({
      where: { legacySubspaceSessionTemplateId: d.sessionTemplateId }
    }),
    metorialDb.magicMcpEndpoint.findFirst({
      where: { legacySubspaceSessionTemplateId: d.sessionTemplateId }
    })
  ]);

  if (!magicMcpLink1 && !magicMcpLink2 && !magicMcpLink3) return;

  throw new ServiceError(
    badRequestError({
      message: `This session template cannot be ${d.action}.`
    })
  );
};

let include = {
  identityActor: true,
  ownerActor: ownerActorSelect,
  identity: true,
  integrationInstance: true,
  integrationInstanceGroup: true,
  providers: {
    include: sessionTemplateProviderInclude,
    where: { status: 'active' as const }
  }
};

let assertCanWriteSessionTemplate = async (
  template: Pick<
    SessionTemplate,
    | 'oid'
    | 'defaultSessionTemplateForIntegrationInstanceOid'
    | 'defaultSessionTemplateForIntegrationInstanceGroupOid'
  >,
  action: 'update' | 'archive'
) => {
  let hasDefaultLink =
    !!template.defaultSessionTemplateForIntegrationInstanceOid ||
    !!template.defaultSessionTemplateForIntegrationInstanceGroupOid;
  let hasEphemeralManagedSession =
    (await db.ephemeralManagedSession.count({
      where: {
        sessionTemplateOid: template.oid,
        status: { not: 'deleted' }
      }
    })) > 0;

  if (!hasDefaultLink && !hasEphemeralManagedSession) return;

  throw new ServiceError(
    badRequestError({
      message: `Cannot ${action} an internally managed session template.`,
      code: 'internal_session_template_readonly'
    })
  );
};

export type ListSessionTemplatesParams = {
  ownership?: OwnershipFilter;
  ownershipWhere?: Record<string, any>;
  includeSystemOwned?: boolean;
  status?: SessionTemplateStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  sessionIds?: string[];
  sessionProviderIds?: string[];
  providerIds?: string[];
  providerDeploymentIds?: string[];
  providerConfigIds?: string[];
  providerAuthConfigIds?: string[];
  integrationIds?: string[];
  integrationInstanceIds?: string[];
  integrationInstanceGroupIds?: string[];
  integrationProviderIds?: string[];
  integrationInstanceProviderIds?: string[];
  integrationInstanceGroupProviderIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetSessionTemplateByIdParams = {
  sessionTemplateId: string;
  allowDeleted?: boolean;
  includeSystemOwned?: boolean;
};

export type GetManySessionTemplatesByIdsParams = {
  ids: string[];
  allowDeleted?: boolean;
  includeSystemOwned?: boolean;
};

export type CreateSessionTemplateParams = {
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    isInternal?: boolean;
    isSystemOwned?: boolean;
    providers: SessionProviderInput[];
  };
  ownershipAccessor?: OwnershipAccessor;
};

export type UpsertInternalLinkedSessionTemplateParams = {
  sessionTemplate?: SessionTemplate | null;
  linkAsDefault?: boolean;
  input: {
    name?: string | null;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
    integrationInstance?: IntegrationInstance | null;
    integrationInstanceGroup?: IntegrationInstanceGroup | null;
    owner?: {
      ownerActorOid: bigint | null;
      isOwnerLocked: boolean;
      isOwnerOnlyVisible?: boolean;
    };
  };
};

export type UpdateSessionTemplateParams = {
  template: SessionTemplate;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    isOwnerOnlyVisible?: boolean;
  };
  _allowLinked?: boolean;
  _allowMagicMcpUpdate?: boolean;
};

export type UpdateSessionTemplateFacingParams = Omit<
  UpdateSessionTemplateParams,
  'template'
> & {
  template: UpdateSessionTemplateParams['template'] & AuditSubspaceSessionTemplate;
};

export type ArchiveSessionTemplateParams = {
  sessionTemplate: SessionTemplate;
  _allowLinked?: boolean;
  _allowMagicMcpDelete?: boolean;
};

export type ListSessionTemplateToolsParams = {
  sessionTemplateId: string;
};

class sessionTemplateServiceImpl {
  async listSessionTemplates(d: MetorialFacing<ListSessionTemplatesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listSessionTemplatesInternal({
      ...rest,
      ownershipWhere: ownedResourceWhere(
        await getOwnershipAccessor({ tenant: scope.tenant, organizationActor }),
        {
          ownership: d.ownership,
          includeSystemOwned: d.includeSystemOwned,
          fallback: { field: 'identityActorOid', relation: 'identityActor' }
        }
      ),
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listSessionTemplatesInternal(
    d: { tenant: Tenant; environment: Environment } & ListSessionTemplatesParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let sessions = await resolveSessions(ts, d.sessionIds);
    let sessionProviders = await resolveProviders(ts, d.sessionProviderIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);
    let integrations = await resolveIntegrations(ts, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(ts, d.integrationInstanceIds);
    let integrationInstanceGroups = await resolveIntegrationInstanceGroups(
      ts,
      d.integrationInstanceGroupIds
    );
    let integrationProviders = await resolveIntegrationProviders(ts, d.integrationProviderIds);
    let integrationInstanceProviders = await resolveIntegrationInstanceProviders(
      ts,
      d.integrationInstanceProviderIds
    );
    let integrationInstanceGroupProviders = await resolveIntegrationInstanceGroupProviders(
      ts,
      d.integrationInstanceGroupProviderIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionTemplate.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              isInternal: false,
              ...(d.includeSystemOwned ? {} : { isSystemOwned: false }),

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ownershipWhere ?? undefined!,
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
                integrations
                  ? { integrationInstance: { integrationOid: integrations.in } }
                  : undefined!,
                integrationInstances
                  ? { integrationInstanceOid: integrationInstances.in }
                  : undefined!,
                integrationInstanceGroups
                  ? { integrationInstanceGroupOid: integrationInstanceGroups.in }
                  : undefined!,
                integrationProviders
                  ? {
                      providers: {
                        some: {
                          integrationInstanceProvider: {
                            integrationProviderOid: integrationProviders.in
                          }
                        }
                      }
                    }
                  : undefined!,
                integrationInstanceProviders
                  ? {
                      providers: {
                        some: {
                          integrationInstanceProviderOid: integrationInstanceProviders.in
                        }
                      }
                    }
                  : undefined!,
                integrationInstanceGroupProviders
                  ? {
                      providers: {
                        some: {
                          integrationInstanceGroupProviderOid:
                            integrationInstanceGroupProviders.in
                        }
                      }
                    }
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

  async getSessionTemplateById(d: MetorialFacing<GetSessionTemplateByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionTemplate = await this.getSessionTemplateByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    assertCanSeeOwnedResource(
      await getOwnershipAccessor({ tenant: scope.tenant, organizationActor }),
      sessionTemplate,
      { resource: 'session.template', id: d.sessionTemplateId }
    );

    return sessionTemplate;
  }

  async getSessionTemplateByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetSessionTemplateByIdParams
  ) {
    let solution = await getMetorialSolution();

    let session = await db.sessionTemplate.findFirst({
      where: {
        id: d.sessionTemplateId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...(d.includeSystemOwned ? {} : { isSystemOwned: false }),
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!session)
      throw new ServiceError(notFoundError('session.template', d.sessionTemplateId));

    return session;
  }

  async getManySessionTemplatesByIds(d: MetorialFacing<GetManySessionTemplatesByIdsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let sessionTemplates = await this.getManySessionTemplatesByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    let accessor = await getOwnershipAccessor({ tenant: scope.tenant, organizationActor });

    return sessionTemplates.filter(sessionTemplate =>
      canSeeOwnedResource(accessor, sessionTemplate)
    );
  }

  async getManySessionTemplatesByIdsInternal(
    d: { tenant: Tenant; environment: Environment } & GetManySessionTemplatesByIdsParams
  ) {
    let solution = await getMetorialSolution();

    return await db.sessionTemplate.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...(d.includeSystemOwned ? {} : { isSystemOwned: false }),
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
  }

  async createSessionTemplate(d: MetorialFacing<CreateSessionTemplateParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session_template.created:before', eventBase);

    let sessionTemplate = await this.createSessionTemplateInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment,
      ownershipAccessor: await getOwnershipAccessor({
        tenant: scope.tenant,
        organizationActor
      })
    });

    await Fabric.fire('provider.session_template.created:after', {
      ...eventBase,
      sessionTemplate
    });

    return sessionTemplate;
  }

  async createSessionTemplateInternal(
    d: { tenant: Tenant; environment: Environment } & CreateSessionTemplateParams
  ) {
    let solution = await getMetorialSolution();

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
          isSystemOwned: !!d.input.isSystemOwned,

          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid
        },
        include
      });

      template.providers =
        await sessionProviderInputService.createSessionTemplateProvidersForInput({
          tenant: d.tenant,
          environment: d.environment,
          template,

          isNewTemplate: true,

          providers: d.input.providers,
          ownershipAccessor: d.ownershipAccessor
        });

      return template;
    });
  }

  async upsertInternalLinkedSessionTemplateInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & UpsertInternalLinkedSessionTemplateParams
  ) {
    let solution = await getMetorialSolution();

    return withTransaction(async db => {
      let data = {
        status: 'active' as const,
        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || null,
        metadata: d.input.metadata ?? Prisma.JsonNull,
        privateMetadata: d.input.privateMetadata ?? Prisma.JsonNull,
        isInternal: true,
        integrationInstanceOid: d.input.integrationInstance?.oid ?? null,
        integrationInstanceGroupOid: d.input.integrationInstanceGroup?.oid ?? null,
        identityActorOid:
          d.input.integrationInstance?.identityActorOid ??
          d.input.integrationInstanceGroup?.identityActorOid ??
          null,
        identityOid:
          d.input.integrationInstance?.identityOid ??
          d.input.integrationInstanceGroup?.identityOid ??
          null,
        ownerActorOid:
          d.input.owner?.ownerActorOid ??
          d.input.integrationInstance?.ownerActorOid ??
          d.input.integrationInstanceGroup?.ownerActorOid ??
          d.sessionTemplate?.ownerActorOid ??
          null,
        isOwnerLocked:
          !!d.input.owner?.isOwnerLocked ||
          !!d.input.integrationInstance?.isOwnerLocked ||
          !!d.input.integrationInstanceGroup?.isOwnerLocked ||
          (!d.input.owner && !!d.sessionTemplate?.isOwnerLocked),
        isOwnerOnlyVisible:
          !!d.input.owner?.isOwnerOnlyVisible ||
          !!d.input.integrationInstance?.isOwnerOnlyVisible ||
          !!d.input.integrationInstanceGroup?.isOwnerOnlyVisible ||
          (!d.input.owner && !!d.sessionTemplate?.isOwnerOnlyVisible),
        defaultSessionTemplateForIntegrationInstanceOid:
          d.linkAsDefault === false ? null : (d.input.integrationInstance?.oid ?? null),
        defaultSessionTemplateForIntegrationInstanceGroupOid:
          d.input.integrationInstanceGroup?.oid ?? null
      };

      if (d.sessionTemplate && !isRecordDeleted(d.sessionTemplate)) {
        return await db.sessionTemplate.update({
          where: {
            oid: d.sessionTemplate.oid,
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid
          },
          data,
          include
        });
      }

      return await db.sessionTemplate.create({
        data: {
          ...getId('sessionTemplate'),
          ...data,
          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid
        },
        include
      });
    });
  }

  async updateSessionTemplate(d: MetorialFacing<UpdateSessionTemplateFacingParams>) {
    let { instance, organizationActor, _allowMagicMcpUpdate, ...rest } = d;

    await assertMagicMcpSessionTemplateMutable({
      sessionTemplateId: d.template.id,
      allow: _allowMagicMcpUpdate,
      action: 'updated'
    });

    let scope = await resolveMetorialFacing(d);

    await assertCanChangeOwnerOnlyVisibility(
      await getOwnershipAccessor({ tenant: scope.tenant, organizationActor }),
      d.template,
      d.input.isOwnerOnlyVisible,
      { resource: 'session template' }
    );

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session_template.updated:before', eventBase);

    let sessionTemplate = await this.updateSessionTemplateInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session_template.updated:after', {
      ...eventBase,
      sessionTemplate,
      previousSessionTemplate: d.template
    });

    return sessionTemplate;
  }

  async updateSessionTemplateInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & Omit<UpdateSessionTemplateParams, '_allowMagicMcpUpdate'>
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.template);
    checkDeletedEdit(d.template, 'update');
    if (!d._allowLinked) await assertCanWriteSessionTemplate(d.template, 'update');

    return withTransaction(async db => {
      let template = await db.sessionTemplate.update({
        where: {
          oid: d.template.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          isOwnerOnlyVisible: d.input.isOwnerOnlyVisible
        },
        include
      });

      return template;
    });
  }

  async archiveSessionTemplate(d: MetorialFacing<ArchiveSessionTemplateParams>) {
    let { instance, organizationActor, _allowMagicMcpDelete, ...rest } = d;

    await assertMagicMcpSessionTemplateMutable({
      sessionTemplateId: d.sessionTemplate.id,
      allow: _allowMagicMcpDelete,
      action: 'deleted'
    });

    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.session_template.deleted:before', eventBase);

    let sessionTemplate = await this.archiveSessionTemplateInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.session_template.deleted:after', {
      ...eventBase,
      sessionTemplate
    });

    return sessionTemplate;
  }

  async archiveSessionTemplateInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & Omit<ArchiveSessionTemplateParams, '_allowMagicMcpDelete'>
  ) {
    checkTenant(d, d.sessionTemplate);
    checkDeletedEdit(d.sessionTemplate, 'archive');
    if (!d._allowLinked) await assertCanWriteSessionTemplate(d.sessionTemplate, 'archive');

    return withSessionTemplateSyncLock(d.sessionTemplate.id, async () =>
      withTransaction(async db => {
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
          sessionTemplateArchivedQueue.add(
            {
              sessionTemplateId: sessionTemplate.id
            },
            { id: queueJobId('sta', sessionTemplate.id) }
          )
        );

        return sessionTemplate;
      })
    );
  }

  async deleteSessionTemplate(d: MetorialFacing<ArchiveSessionTemplateParams>) {
    return this.archiveSessionTemplate(d);
  }

  async deleteSessionTemplateInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & Omit<ArchiveSessionTemplateParams, '_allowMagicMcpDelete'>
  ) {
    return this.archiveSessionTemplateInternal(d);
  }

  async listSessionTemplateTools(d: MetorialFacing<ListSessionTemplateToolsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listSessionTemplateToolsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listSessionTemplateToolsInternal(
    d: { tenant: Tenant; environment: Environment } & ListSessionTemplateToolsParams
  ) {
    let sessionTemplate = await this.getSessionTemplateByIdInternal({
      tenant: d.tenant,
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

      let paginator = await providerToolService.listProviderToolsInternal({
        tenant: d.tenant,
        environment: d.environment,
        providerVersion: currentVersion
      });

      let after: string | undefined;

      while (true) {
        let list = await paginator.run({ limit: 100, ...(after ? { after } : {}) });

        for (let tool of list.items) {
          if (toolMap.has(tool.key)) continue;

          let { allowed } = checkToolAccess(tool, templateProvider, 'list');
          if (allowed) toolMap.set(tool.key, tool);
        }

        if (!list.pagination.hasNextPage || list.items.length === 0) break;
        after = list.items[list.items.length - 1]!.id;
      }
    }

    return Array.from(toolMap.values());
  }
}

export let sessionTemplateService = Service.create(
  'session',
  () => new sessionTemplateServiceImpl()
).build();
