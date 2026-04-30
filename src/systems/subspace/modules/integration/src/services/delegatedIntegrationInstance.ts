import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type DelegatedIntegrationInstance,
  type DelegatedIntegrationInstanceStatus,
  type Environment,
  getId,
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
import { syncDelegatedIntegrationInstanceSessionTemplateQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedDelegatedIntegrationTemplate';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  delegatedIntegrationInstanceArchivedQueue,
  delegatedIntegrationInstanceCreatedQueue,
  delegatedIntegrationInstanceUpdatedQueue
} from '../queues/lifecycle/delegatedIntegrationInstance';
import {
  delegatedIntegrationInstanceProviderService,
  type SetDelegatedIntegrationInstanceProviderInput
} from './delegatedIntegrationInstanceProvider';
import { integrationInstanceProviderInclude } from './integrationInstance';

export let delegatedIntegrationInstanceProviderInclude = {
  delegatedIntegrationInstance: true,
  delegatedIntegrationInstanceSource: {
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

export let delegatedIntegrationInstanceInclude = {
  sources: {
    where: { status: 'active' as const, isParentDeleted: false },
    include: {
      integrationInstance: true
    }
  },
  providers: {
    where: { status: 'active' as const, isParentDeleted: false },
    include: delegatedIntegrationInstanceProviderInclude
  }
} as const;

let linkedDelegatedSessionTemplateInclude = {
  integrationInstance: true,
  delegatedIntegrationInstance: true,
  providers: {
    where: { status: 'active' as const },
    include: {
      provider: true,
      deployment: true,
      config: true,
      authConfig: true,
      integrationInstanceProvider: true,
      delegatedIntegrationInstanceProvider: true,
      sessionTemplate: {
        include: {
          integrationInstance: true,
          delegatedIntegrationInstance: true
        }
      }
    }
  }
} as const;

class delegatedIntegrationInstanceServiceImpl {
  async listDelegatedIntegrationInstances(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: DelegatedIntegrationInstanceStatus[];
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
          await db.delegatedIntegrationInstance.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

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
            include: delegatedIntegrationInstanceInclude
          })
      )
    );
  }

  async getDelegatedIntegrationInstanceById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstanceId: string;
    allowDeleted?: boolean;
  }) {
    let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.findFirst({
      where: {
        id: d.delegatedIntegrationInstanceId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: delegatedIntegrationInstanceInclude
    });
    if (!delegatedIntegrationInstance) {
      throw new ServiceError(
        notFoundError('delegated.integration.instance', d.delegatedIntegrationInstanceId)
      );
    }

    return delegatedIntegrationInstance;
  }

  async createDelegatedIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      providers?: SetDelegatedIntegrationInstanceProviderInput[];
    };
  }) {
    return await withTransaction(async db => {
      let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.create({
        data: {
          ...getId('delegatedIntegrationInstance'),
          status: 'draft',
          name: d.input.name.trim(),
          description: d.input.description?.trim(),
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: delegatedIntegrationInstanceInclude
      });

      if (d.input.providers?.length) {
        await delegatedIntegrationInstanceProviderService.setDelegatedIntegrationInstanceProviders(
          {
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            delegatedIntegrationInstance,
            input: d.input.providers
          }
        );

        delegatedIntegrationInstance = await db.delegatedIntegrationInstance.findUniqueOrThrow(
          {
            where: { oid: delegatedIntegrationInstance.oid },
            include: delegatedIntegrationInstanceInclude
          }
        );
      }

      await addAfterTransactionHook(async () =>
        delegatedIntegrationInstanceCreatedQueue.add({
          delegatedIntegrationInstanceId: delegatedIntegrationInstance.id
        })
      );

      return delegatedIntegrationInstance;
    });
  }

  async updateDelegatedIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstance: DelegatedIntegrationInstance;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      providers?: SetDelegatedIntegrationInstanceProviderInput[];
    };
  }) {
    checkTenant(d, d.delegatedIntegrationInstance);
    checkDeletedEdit(d.delegatedIntegrationInstance, 'update');

    return await withTransaction(async db => {
      let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.update({
        where: {
          oid: d.delegatedIntegrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.delegatedIntegrationInstance.name,
          description:
            d.input.description === undefined
              ? d.delegatedIntegrationInstance.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined
              ? d.delegatedIntegrationInstance.metadata
              : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.delegatedIntegrationInstance.privateMetadata
              : d.input.privateMetadata
        },
        include: delegatedIntegrationInstanceInclude
      });

      if (d.input.providers?.length) {
        await delegatedIntegrationInstanceProviderService.setDelegatedIntegrationInstanceProviders(
          {
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            delegatedIntegrationInstance,
            input: d.input.providers
          }
        );

        delegatedIntegrationInstance = await db.delegatedIntegrationInstance.findUniqueOrThrow(
          {
            where: { oid: delegatedIntegrationInstance.oid },
            include: delegatedIntegrationInstanceInclude
          }
        );
      }

      await addAfterTransactionHook(async () =>
        delegatedIntegrationInstanceUpdatedQueue.add({
          delegatedIntegrationInstanceId: delegatedIntegrationInstance.id
        })
      );

      return delegatedIntegrationInstance;
    });
  }

  async createSessionTemplateForDelegatedIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstance: DelegatedIntegrationInstance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.delegatedIntegrationInstance);
    checkDeletedRelation(d.delegatedIntegrationInstance);

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
          delegatedIntegrationInstanceOid: d.delegatedIntegrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: linkedDelegatedSessionTemplateInclude
      });

      await addAfterTransactionHook(async () =>
        syncDelegatedIntegrationInstanceSessionTemplateQueue.add({
          sessionTemplateId: sessionTemplate.id
        })
      );

      return sessionTemplate;
    });
  }

  async archiveDelegatedIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstance: DelegatedIntegrationInstance;
  }) {
    checkTenant(d, d.delegatedIntegrationInstance);
    checkDeletedEdit(d.delegatedIntegrationInstance, 'archive');

    return await withTransaction(async db => {
      let delegatedIntegrationInstance = await db.delegatedIntegrationInstance.update({
        where: {
          oid: d.delegatedIntegrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include: delegatedIntegrationInstanceInclude
      });

      await addAfterTransactionHook(async () =>
        delegatedIntegrationInstanceArchivedQueue.add({
          delegatedIntegrationInstanceId: delegatedIntegrationInstance.id
        })
      );

      return delegatedIntegrationInstance;
    });
  }

  async deleteDelegatedIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstance: DelegatedIntegrationInstance;
  }) {
    return await this.archiveDelegatedIntegrationInstance(d);
  }
}

export let delegatedIntegrationInstanceService = Service.create(
  'delegatedIntegrationInstance',
  () => new delegatedIntegrationInstanceServiceImpl()
).build();
