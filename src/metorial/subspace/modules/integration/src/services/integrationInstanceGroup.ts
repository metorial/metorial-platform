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
  type IntegrationInstanceGroupStatus,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIntegrationInstanceProviders,
  resolveIntegrationInstances,
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { identityActorService, identityService } from '@metorial-subspace/module-identity';
import { finalizeSessionCreate, sessionService, sessionTemplateService } from '@metorial-subspace/module-session';
import { enqueueSyncIntegrationInstanceGroupSessionTemplate } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { type SessionProviderTemplateInput } from '@metorial-subspace/module-session/src/services/sessionProviderInput';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  integrationInstanceGroupArchivedQueue,
  integrationInstanceGroupCreatedQueue,
  integrationInstanceGroupUpdatedQueue
} from '../queues/lifecycle/integrationInstanceGroup';
import { integrationInstanceProviderInclude } from './integrationInstance';
import {
  integrationInstanceGroupProviderService,
  type SetIntegrationInstanceGroupProviderInput
} from './integrationInstanceGroupProvider';

export let integrationInstanceGroupProviderInclude = {
  integrationInstanceGroup: true,
  integrationInstanceGroupSource: {
    include: {
      integrationInstance: true
    }
  },
  integration: true,
  integrationInstance: true,
  integrationInstanceProvider: {
    include: integrationInstanceProviderInclude
  },
  integrationProvider: {
    include: {
      integration: true,
      provider: true,
      currentVersion: {
        include: {
          deployment: true,
          authMethod: {
            include: {
              specification: {
                omit: { value: true }
              }
            }
          },
          authCredentials: true,
          config: true
        }
      }
    }
  }
} as const;

export let integrationInstanceGroupInclude = {
  identityActor: true,
  identity: true,
  defaultSessionTemplate: true,
  sources: {
    where: { status: 'active' as const, isParentDeleted: false },
    include: {
      integrationInstanceGroup: true,
      integrationInstance: true
    }
  },
  providers: {
    where: { status: 'active' as const, isParentDeleted: false },
    include: integrationInstanceGroupProviderInclude
  },
  magicMcpEndpointBacking: true
} as const;

type IntegrationInstanceGroupWriteInput = {
  name: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
  identityActorId?: string | null;
  identityId?: string | null;
  identitySourceIntegrationInstances?: Pick<
    IntegrationInstance,
    'identityActorOid' | 'identityOid'
  >[];
};

let DEFAULT_SESSION_TEMPLATE_POLL_INTERVAL_MS = 250;
let DEFAULT_SESSION_TEMPLATE_POLL_ATTEMPTS = 20;

let wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let defaultSessionTemplateTimeoutError = () =>
  badRequestError({
    message: 'Timed out waiting for the default session template to become available.',
    code: 'default_session_template_timeout'
  });

export type ListIntegrationInstanceGroupsParams = {
  includeMagicMcpBackings?: boolean;

  status?: IntegrationInstanceGroupStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  integrationIds?: string[];
  integrationInstanceIds?: string[];
  integrationInstanceProviderIds?: string[];
  providerIds?: string[];
  integrationProviderIds?: string[];
  providerDeploymentIds?: string[];
  providerConfigIds?: string[];
  providerAuthConfigIds?: string[];
  sessionTemplateIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIntegrationInstanceGroupByIdParams = {
  integrationInstanceGroupId: string;
  allowDeleted?: boolean;
};

export type CreateIntegrationInstanceGroupParams = {
  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    identityActorId?: string | null;
    identityId?: string | null;
    providers?: SetIntegrationInstanceGroupProviderInput[];
  };
};

export type UpsertMagicMcpIntegrationInstanceGroupParams = {
  integrationInstanceGroup?: IntegrationInstanceGroup | null;
  input: {
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
    identityActorId?: string | null;
    identityId?: string | null;
    identitySourceIntegrationInstances?: Pick<
      IntegrationInstance,
      'identityActorOid' | 'identityOid'
    >[];
  };
};

export type UpdateIntegrationInstanceGroupParams = {
  integrationInstanceGroup: IntegrationInstanceGroup;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
    identityActorId?: string | null;
    identityId?: string | null;
    providers?: SetIntegrationInstanceGroupProviderInput[];
  };
};

export type CreateSessionTemplateForIntegrationInstanceGroupParams = {
  integrationInstanceGroup: IntegrationInstanceGroup;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  };
};

export type WaitForDefaultSessionTemplateForIntegrationInstanceGroupParams = {
  integrationInstanceGroup: IntegrationInstanceGroup;
};

export type CreateSessionForIntegrationInstanceGroupParams = {
  integrationInstanceGroup: IntegrationInstanceGroup;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  };
};

export type ArchiveIntegrationInstanceGroupParams = {
  integrationInstanceGroup: IntegrationInstanceGroup;
  _canModifyMagicMcpBacking?: boolean;
};

class integrationInstanceGroupServiceImpl {
  private async resolveIdentitySnapshot(d: {
    tenant: Tenant;
    environment: Environment;
    current?: Pick<IntegrationInstanceGroup, 'identityActorOid' | 'identityOid'> | null;
    input: Pick<
      IntegrationInstanceGroupWriteInput,
      'identityActorId' | 'identityId' | 'identitySourceIntegrationInstances'
    >;
  }) {
    if (d.input.identityActorId !== undefined || d.input.identityId !== undefined) {
      let identity = d.input.identityId
        ? await identityService.getIdentityByIdInternal({
            tenant: d.tenant,
            environment: d.environment,
            identityId: d.input.identityId
          })
        : null;

      let actor = d.input.identityActorId
        ? await identityActorService.getIdentityActorByIdInternal({
            tenant: d.tenant,
            environment: d.environment,
            identityActorId: d.input.identityActorId
          })
        : null;

      return {
        identityActorOid: actor?.oid ?? identity?.actorOid ?? null,
        identityOid: identity?.oid ?? null
      };
    }

    let source = d.input.identitySourceIntegrationInstances?.find(
      integrationInstance =>
        integrationInstance.identityActorOid || integrationInstance.identityOid
    );
    if (source) {
      return {
        identityActorOid: source.identityActorOid ?? null,
        identityOid: source.identityOid ?? null
      };
    }

    return {
      identityActorOid: d.current?.identityActorOid ?? null,
      identityOid: d.current?.identityOid ?? null
    };
  }

  private async applyIdentity(d: {
    db: {
      integrationInstanceGroup: typeof db.integrationInstanceGroup;
    };
    tenant: Tenant;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup & {
      sources?: { integrationInstance: IntegrationInstance }[];
    };
    input: IntegrationInstanceGroupWriteInput;
  }) {
    let identity = await this.resolveIdentitySnapshot({
      tenant: d.tenant,
      environment: d.environment,
      current: d.integrationInstanceGroup,
      input: {
        identityActorId: d.input.identityActorId,
        identityId: d.input.identityId,
        identitySourceIntegrationInstances:
          d.input.identitySourceIntegrationInstances ??
          d.integrationInstanceGroup.sources?.map(source => source.integrationInstance)
      }
    });

    return await d.db.integrationInstanceGroup.update({
      where: { oid: d.integrationInstanceGroup.oid },
      data: identity,
      include: integrationInstanceGroupInclude
    });
  }

  private integrationInstanceGroupCreateData(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    id: ReturnType<typeof getId>;
    input: IntegrationInstanceGroupWriteInput;
    isMagicMcpBacking?: boolean;
  }) {
    return {
      ...d.id,
      status: 'draft' as const,
      isMagicMcpBacking: !!d.isMagicMcpBacking,
      name: d.input.name.trim(),
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid
    };
  }

  private integrationInstanceGroupUpdateData(d: {
    input: IntegrationInstanceGroupWriteInput;
    isMagicMcpBacking?: boolean;
  }) {
    return {
      status: d.isMagicMcpBacking ? ('active' as const) : undefined,
      archivedAt: d.isMagicMcpBacking ? null : undefined,
      isMagicMcpBacking: d.isMagicMcpBacking,
      name: d.input.name.trim(),
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata
    };
  }

  async listIntegrationInstanceGroups(d: MetorialFacing<ListIntegrationInstanceGroupsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listIntegrationInstanceGroupsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listIntegrationInstanceGroupsInternal(
    d: { tenant: Tenant; environment: Environment } & ListIntegrationInstanceGroupsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let integrations = await resolveIntegrations(ts, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(ts, d.integrationInstanceIds);
    let integrationInstanceProviders = await resolveIntegrationInstanceProviders(
      ts,
      d.integrationInstanceProviderIds
    );
    let providers = await resolveProviders(ts, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(ts, d.integrationProviderIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);
    let sessionTemplates = await resolveSessionTemplates(ts, d.sessionTemplateIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationInstanceGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              isMagicMcpBacking: d.includeMagicMcpBackings ? undefined : false,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                integrations
                  ? { providers: { some: { integrationOid: integrations.in } } }
                  : undefined!,
                integrationInstances
                  ? { sources: { some: { integrationInstanceOid: integrationInstances.in } } }
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
                providers
                  ? {
                      providers: {
                        some: { integrationProvider: { providerOid: providers.in } }
                      }
                    }
                  : undefined!,
                integrationProviders
                  ? {
                      providers: { some: { integrationProviderOid: integrationProviders.in } }
                    }
                  : undefined!,
                deployments
                  ? {
                      providers: {
                        some: {
                          integrationInstanceProvider: {
                            currentVersion: {
                              integrationProviderVersion: { deploymentOid: deployments.in }
                            }
                          }
                        }
                      }
                    }
                  : undefined!,
                configs
                  ? {
                      providers: {
                        some: {
                          integrationInstanceProvider: {
                            currentVersion: { configOid: configs.in }
                          }
                        }
                      }
                    }
                  : undefined!,
                authConfigs
                  ? {
                      providers: {
                        some: {
                          integrationInstanceProvider: {
                            currentVersion: { authConfigOid: authConfigs.in }
                          }
                        }
                      }
                    }
                  : undefined!,
                sessionTemplates
                  ? { sessionTemplates: { some: { oid: sessionTemplates.in } } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationInstanceGroupInclude
          })
      )
    );
  }

  async getIntegrationInstanceGroupById(d: MetorialFacing<GetIntegrationInstanceGroupByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getIntegrationInstanceGroupByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getIntegrationInstanceGroupByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetIntegrationInstanceGroupByIdParams
  ) {
    let solution = await getMetorialSolution();

    let integrationInstanceGroup = await db.integrationInstanceGroup.findFirst({
      where: {
        id: d.integrationInstanceGroupId,
        tenantOid: d.tenant.oid,
        solution,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: integrationInstanceGroupInclude
    });
    if (!integrationInstanceGroup) {
      throw new ServiceError(
        notFoundError('integration.instance.group', d.integrationInstanceGroupId)
      );
    }

    return integrationInstanceGroup;
  }

  async createIntegrationInstanceGroup(d: MetorialFacing<CreateIntegrationInstanceGroupParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.createIntegrationInstanceGroupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createIntegrationInstanceGroupInternal(
    d: { tenant: Tenant; environment: Environment } & CreateIntegrationInstanceGroupParams
  ) {
    let solution = await getMetorialSolution();

    return await withTransaction(async db => {
      let newId = getId('integrationInstanceGroup');
      let integrationInstanceGroup = await db.integrationInstanceGroup.create({
        data: this.integrationInstanceGroupCreateData({
          tenant: d.tenant,
          solution,
          environment: d.environment,
          id: newId,
          input: d.input
        }),
        include: integrationInstanceGroupInclude
      });

      if (d.input.providers?.length) {
        await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProvidersInternal(
          {
            tenant: d.tenant,
            environment: d.environment,
            integrationInstanceGroup,
            input: d.input.providers
          }
        );

        integrationInstanceGroup = await db.integrationInstanceGroup.findUniqueOrThrow({
          where: { oid: integrationInstanceGroup.oid },
          include: integrationInstanceGroupInclude
        });
      }

      integrationInstanceGroup = await this.applyIdentity({
        db,
        tenant: d.tenant,
        environment: d.environment,
        integrationInstanceGroup,
        input: d.input
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceGroupCreatedQueue.add({
          integrationInstanceGroupId: integrationInstanceGroup.id
        })
      );

      return integrationInstanceGroup;
    });
  }

  async upsertMagicMcpIntegrationInstanceGroupInternal(
    d: { tenant: Tenant; environment: Environment } & UpsertMagicMcpIntegrationInstanceGroupParams
  ) {
    let solution = await getMetorialSolution();

    return await withTransaction(async db => {
      if (d.integrationInstanceGroup) {
        checkTenant(d, d.integrationInstanceGroup);

        let integrationInstanceGroup = await db.integrationInstanceGroup.update({
          where: {
            oid: d.integrationInstanceGroup.oid,
            tenantOid: d.tenant.oid,
            solution,
            environmentOid: d.environment.oid
          },
          data: this.integrationInstanceGroupUpdateData({
            input: d.input,
            isMagicMcpBacking: true
          }),
          include: integrationInstanceGroupInclude
        });

        integrationInstanceGroup = await this.applyIdentity({
          db,
          tenant: d.tenant,
          environment: d.environment,
          integrationInstanceGroup,
          input: d.input
        });

        await addAfterTransactionHook(async () =>
          integrationInstanceGroupUpdatedQueue.add({
            integrationInstanceGroupId: integrationInstanceGroup.id
          })
        );

        return integrationInstanceGroup;
      }

      let newId = getId('integrationInstanceGroup');
      let integrationInstanceGroup = await db.integrationInstanceGroup.create({
        data: this.integrationInstanceGroupCreateData({
          tenant: d.tenant,
          solution,
          environment: d.environment,
          id: newId,
          input: d.input,
          isMagicMcpBacking: true
        }),
        include: integrationInstanceGroupInclude
      });

      integrationInstanceGroup = await this.applyIdentity({
        db,
        tenant: d.tenant,
        environment: d.environment,
        integrationInstanceGroup,
        input: d.input
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceGroupCreatedQueue.add({
          integrationInstanceGroupId: integrationInstanceGroup.id
        })
      );

      return integrationInstanceGroup;
    });
  }

  async updateIntegrationInstanceGroup(d: MetorialFacing<UpdateIntegrationInstanceGroupParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateIntegrationInstanceGroupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateIntegrationInstanceGroupInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateIntegrationInstanceGroupParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integrationInstanceGroup);
    checkDeletedEdit(d.integrationInstanceGroup, 'update');
    if (d.integrationInstanceGroup.isMagicMcpBacking) {
      throw new ServiceError(
        badRequestError({
          message: 'Magic MCP backed integration instance groups cannot be updated directly.',
          code: 'magic_mcp_backing_integration_group_update_blocked'
        })
      );
    }

    return await withTransaction(async db => {
      let integrationInstanceGroup = await db.integrationInstanceGroup.update({
        where: {
          oid: d.integrationInstanceGroup.oid,
          tenantOid: d.tenant.oid,
          solution,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.integrationInstanceGroup.name,
          description:
            d.input.description === undefined
              ? d.integrationInstanceGroup.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined
              ? d.integrationInstanceGroup.metadata
              : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.integrationInstanceGroup.privateMetadata
              : d.input.privateMetadata
        },
        include: integrationInstanceGroupInclude
      });

      if (d.input.providers?.length) {
        await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProvidersInternal(
          {
            tenant: d.tenant,
            environment: d.environment,
            integrationInstanceGroup,
            input: d.input.providers
          }
        );

        integrationInstanceGroup = await db.integrationInstanceGroup.findUniqueOrThrow({
          where: { oid: integrationInstanceGroup.oid },
          include: integrationInstanceGroupInclude
        });
      }

      integrationInstanceGroup = await this.applyIdentity({
        db,
        tenant: d.tenant,
        environment: d.environment,
        integrationInstanceGroup,
        input: {
          name: integrationInstanceGroup.name,
          description: integrationInstanceGroup.description,
          metadata: integrationInstanceGroup.metadata as Record<string, any> | null,
          privateMetadata: integrationInstanceGroup.privateMetadata as Record<
            string,
            any
          > | null,
          identityActorId: d.input.identityActorId,
          identityId: d.input.identityId
        }
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceGroupUpdatedQueue.add({
          integrationInstanceGroupId: integrationInstanceGroup.id
        })
      );

      return integrationInstanceGroup;
    });
  }

  async createSessionTemplateForIntegrationInstanceGroupInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & CreateSessionTemplateForIntegrationInstanceGroupParams
  ) {
    checkTenant(d, d.integrationInstanceGroup);
    checkDeletedRelation(d.integrationInstanceGroup);

    return await withTransaction(async db => {
      let currentIntegrationInstanceGroup =
        await db.integrationInstanceGroup.findUniqueOrThrow({
          where: { oid: d.integrationInstanceGroup.oid },
          include: integrationInstanceGroupInclude
        });

      let sessionTemplate =
        await sessionTemplateService.upsertInternalLinkedSessionTemplateInternal({
          tenant: d.tenant,
          environment: d.environment,
          sessionTemplate: currentIntegrationInstanceGroup.defaultSessionTemplate,
          input: {
            name: d.input.name,
            description: d.input.description,
            metadata: d.input.metadata,
            privateMetadata: d.input.privateMetadata,
            integrationInstanceGroup: currentIntegrationInstanceGroup
          }
        });

      await addAfterTransactionHook(async () =>
        enqueueSyncIntegrationInstanceGroupSessionTemplate(sessionTemplate.id)
      );

      return sessionTemplate;
    });
  }

  async waitForDefaultSessionTemplateForIntegrationInstanceGroupInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & WaitForDefaultSessionTemplateForIntegrationInstanceGroupParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integrationInstanceGroup);
    checkDeletedRelation(d.integrationInstanceGroup);

    for (let attempt = 0; attempt < DEFAULT_SESSION_TEMPLATE_POLL_ATTEMPTS; attempt++) {
      let integrationInstanceGroup = await db.integrationInstanceGroup.findFirst({
        where: {
          oid: d.integrationInstanceGroup.oid,
          tenantOid: d.tenant.oid,
          solution,
          environmentOid: d.environment.oid,
          status: { notIn: ['archived', 'deleted'] }
        },
        include: {
          providers: {
            where: {
              status: 'active',
              isParentDeleted: false,
              integrationInstanceProvider: {
                status: 'active',
                isParentDeleted: false,
                currentVersion: { configOid: { not: null } }
              }
            },
            select: { oid: true }
          },
          defaultSessionTemplate: {
            include: {
              providers: {
                where: { status: 'active' },
                include: {
                  deployment: true,
                  config: true,
                  authConfig: true
                }
              }
            }
          }
        }
      });

      let template = integrationInstanceGroup?.defaultSessionTemplate;
      let expectedProviderCount = integrationInstanceGroup?.providers.length ?? 0;
      if (template && template.providers.length >= expectedProviderCount) {
        return template as SessionProviderTemplateInput;
      }

      if (attempt < DEFAULT_SESSION_TEMPLATE_POLL_ATTEMPTS - 1) {
        await wait(DEFAULT_SESSION_TEMPLATE_POLL_INTERVAL_MS);
      }
    }

    throw new ServiceError(defaultSessionTemplateTimeoutError());
  }

  async createSessionForIntegrationInstanceGroup(
    d: MetorialFacing<CreateSessionForIntegrationInstanceGroupParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let session = await this.createSessionForIntegrationInstanceGroupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return await finalizeSessionCreate({
      instance,
      session
    });
  }

  async createSessionForIntegrationInstanceGroupInternal(
    d: { tenant: Tenant; environment: Environment } & CreateSessionForIntegrationInstanceGroupParams
  ) {
    checkTenant(d, d.integrationInstanceGroup);
    checkDeletedRelation(d.integrationInstanceGroup);

    let template = await this.waitForDefaultSessionTemplateForIntegrationInstanceGroupInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationInstanceGroup: d.integrationInstanceGroup
    });

    return await sessionService.createSessionInternal({
      tenant: d.tenant,
      environment: d.environment,
      input: {
        ...d.input,
        providers: [
          {
            sessionTemplateId: template.id,
            __sessionTemplate: template
          }
        ]
      }
    });
  }

  async archiveIntegrationInstanceGroup(d: MetorialFacing<ArchiveIntegrationInstanceGroupParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.archiveIntegrationInstanceGroupInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveIntegrationInstanceGroupInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveIntegrationInstanceGroupParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integrationInstanceGroup);
    checkDeletedEdit(d.integrationInstanceGroup, 'archive');
    if (d.integrationInstanceGroup.isMagicMcpBacking && !d._canModifyMagicMcpBacking) {
      throw new ServiceError(
        badRequestError({
          message: 'Magic MCP backed integration instance groups cannot be deleted directly.',
          code: 'magic_mcp_backing_integration_group_delete_blocked'
        })
      );
    }

    return await withTransaction(async db => {
      let integrationInstanceGroup = await db.integrationInstanceGroup.update({
        where: {
          oid: d.integrationInstanceGroup.oid,
          tenantOid: d.tenant.oid,
          solution,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include: integrationInstanceGroupInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceGroupArchivedQueue.add({
          integrationInstanceGroupId: integrationInstanceGroup.id
        })
      );

      return integrationInstanceGroup;
    });
  }

  async deleteIntegrationInstanceGroup(d: MetorialFacing<ArchiveIntegrationInstanceGroupParams>) {
    return await this.archiveIntegrationInstanceGroup(d);
  }

  async deleteIntegrationInstanceGroupInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveIntegrationInstanceGroupParams
  ) {
    return await this.archiveIntegrationInstanceGroupInternal(d);
  }
}

export let integrationInstanceGroupService = Service.create(
  'integrationInstanceGroup',
  () => new integrationInstanceGroupServiceImpl()
).build();
