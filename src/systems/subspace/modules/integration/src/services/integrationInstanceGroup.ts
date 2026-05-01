import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
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
import { syncIntegrationInstanceGroupSessionTemplateQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { checkTenant } from '@metorial-subspace/module-tenant';
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

let linkedGroupSessionTemplateInclude = {
  integrationInstance: true,
  integrationInstanceGroup: true,
  providers: {
    where: { status: 'active' as const },
    include: {
      provider: true,
      deployment: true,
      config: true,
      authConfig: true,
      integrationInstanceProvider: true,
      integrationInstanceGroupProvider: true,
      sessionTemplate: {
        include: {
          integrationInstance: true,
          integrationInstanceGroup: true
        }
      }
    }
  }
} as const;

type IntegrationInstanceGroupWriteInput = {
  name: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
};

class integrationInstanceGroupServiceImpl {
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

  async listIntegrationInstanceGroups(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

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
  }) {
    let integrations = await resolveIntegrations(d, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(d, d.integrationInstanceIds);
    let integrationInstanceProviders = await resolveIntegrationInstanceProviders(
      d,
      d.integrationInstanceProviderIds
    );
    let providers = await resolveProviders(d, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(d, d.integrationProviderIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationInstanceGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isMagicMcpBacking: false,

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

  async getIntegrationInstanceGroupById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroupId: string;
    allowDeleted?: boolean;
  }) {
    let integrationInstanceGroup = await db.integrationInstanceGroup.findFirst({
      where: {
        id: d.integrationInstanceGroupId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
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

  async createIntegrationInstanceGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      providers?: SetIntegrationInstanceGroupProviderInput[];
    };
  }) {
    return await withTransaction(async db => {
      let newId = getId('integrationInstanceGroup');
      let integrationInstanceGroup = await db.integrationInstanceGroup.create({
        data: this.integrationInstanceGroupCreateData({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          id: newId,
          input: d.input
        }),
        include: integrationInstanceGroupInclude
      });

      if (d.input.providers?.length) {
        await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProviders({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          integrationInstanceGroup,
          input: d.input.providers
        });

        integrationInstanceGroup = await db.integrationInstanceGroup.findUniqueOrThrow({
          where: { oid: integrationInstanceGroup.oid },
          include: integrationInstanceGroupInclude
        });
      }

      await addAfterTransactionHook(async () =>
        integrationInstanceGroupCreatedQueue.add({
          integrationInstanceGroupId: integrationInstanceGroup.id
        })
      );

      return integrationInstanceGroup;
    });
  }

  async upsertMagicMcpIntegrationInstanceGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup?: IntegrationInstanceGroup | null;
    input: {
      name: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
    };
  }) {
    return await withTransaction(async db => {
      if (d.integrationInstanceGroup) {
        checkTenant(d, d.integrationInstanceGroup);

        let integrationInstanceGroup = await db.integrationInstanceGroup.update({
          where: {
            oid: d.integrationInstanceGroup.oid,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid
          },
          data: this.integrationInstanceGroupUpdateData({
            input: d.input,
            isMagicMcpBacking: true
          }),
          include: integrationInstanceGroupInclude
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
          solution: d.solution,
          environment: d.environment,
          id: newId,
          input: d.input,
          isMagicMcpBacking: true
        }),
        include: integrationInstanceGroupInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceGroupCreatedQueue.add({
          integrationInstanceGroupId: integrationInstanceGroup.id
        })
      );

      return integrationInstanceGroup;
    });
  }

  async updateIntegrationInstanceGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      providers?: SetIntegrationInstanceGroupProviderInput[];
    };
  }) {
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
          solutionOid: d.solution.oid,
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
        await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProviders({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          integrationInstanceGroup,
          input: d.input.providers
        });

        integrationInstanceGroup = await db.integrationInstanceGroup.findUniqueOrThrow({
          where: { oid: integrationInstanceGroup.oid },
          include: integrationInstanceGroupInclude
        });
      }

      await addAfterTransactionHook(async () =>
        integrationInstanceGroupUpdatedQueue.add({
          integrationInstanceGroupId: integrationInstanceGroup.id
        })
      );

      return integrationInstanceGroup;
    });
  }

  async createSessionTemplateForIntegrationInstanceGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.integrationInstanceGroup);
    checkDeletedRelation(d.integrationInstanceGroup);

    return await withTransaction(async db => {
      let sessionTemplate = await db.sessionTemplate.create({
        data: {
          ...getId('sessionTemplate'),
          status: 'active',
          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          isInternal: false,
          integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: linkedGroupSessionTemplateInclude
      });

      await addAfterTransactionHook(async () =>
        syncIntegrationInstanceGroupSessionTemplateQueue.add({
          sessionTemplateId: sessionTemplate.id
        })
      );

      return sessionTemplate;
    });
  }

  async archiveIntegrationInstanceGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup;
    _canModifyMagicMcpBacking?: boolean;
  }) {
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
          solutionOid: d.solution.oid,
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

  async deleteIntegrationInstanceGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup;
  }) {
    return await this.archiveIntegrationInstanceGroup(d);
  }
}

export let integrationInstanceGroupService = Service.create(
  'integrationInstanceGroup',
  () => new integrationInstanceGroupServiceImpl()
).build();
