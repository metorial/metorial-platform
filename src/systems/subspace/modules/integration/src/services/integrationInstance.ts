import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Identity,
  type IdentityActor,
  type Integration,
  type IntegrationInstance,
  type IntegrationInstanceStatus,
  type Solution,
  type Tenant,
  type TransactionDB,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIdentities,
  resolveIdentityActors,
  resolveIdentityCredentials,
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import {
  identityActorService,
  identityInternalService
} from '@metorial-subspace/module-identity';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { syncIntegrationInstanceSessionTemplateQueue } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  integrationInstanceArchivedQueue,
  integrationInstanceCreatedQueue,
  integrationInstanceUpdatedQueue
} from '../queues/lifecycle/integrationInstance';
import { integrationProviderVersionInclude } from './integration';
import {
  integrationInstanceProviderService,
  type SetIntegrationInstanceProviderInput
} from './integrationInstanceProvider';

export let integrationInstanceProviderVersionInclude = {
  integrationProviderVersion: {
    include: integrationProviderVersionInclude
  },
  config: { include: { provider: true } },
  authConfig: { include: { provider: true } }
} as const;

export let integrationInstanceProviderInclude = {
  integration: true,
  integrationInstance: true,
  integrationProvider: {
    include: {
      integration: true,
      provider: true,
      currentVersion: {
        include: integrationProviderVersionInclude
      }
    }
  },
  currentVersion: {
    include: integrationInstanceProviderVersionInclude
  }
} as const;

export let integrationInstanceInclude = {
  integration: true,
  identityActor: true,
  identity: true,
  integrationInstanceProviders: {
    where: { status: 'active' as const, isParentDeleted: false },
    include: integrationInstanceProviderInclude
  },
  magicMcpServerBacking: true
} as const;

let linkedSessionTemplateInclude = {
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

type IntegrationIdentityInput = {
  identityActorId?: string | null;
  identityId?: string | null;
};

type IntegrationInstanceWriteInput = {
  name: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
  identityActorId?: string | null;
  identityId?: string | null;
  providers?: SetIntegrationInstanceProviderInput[];
};

let mergeIntegrationIdentityInput = (d: {
  current?: {
    identityActor: Pick<IdentityActor, 'id'> | null;
    identity: Pick<Identity, 'id'> | null;
  } | null;
  input: IntegrationIdentityInput;
}) => ({
  identityActorId:
    d.input.identityActorId !== undefined
      ? d.input.identityActorId
      : (d.current?.identityActor?.id ?? null),
  identityId:
    d.input.identityActorId !== undefined
      ? d.input.identityId !== undefined
        ? d.input.identityId
        : null
      : d.input.identityId !== undefined
        ? d.input.identityId
        : (d.current?.identity?.id ?? null)
});

let resolveIntegrationIdentity = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  integrationInstance: IntegrationInstance;
  input: {
    identityActorId: string | null;
    identityId: string | null;
  };
}) => {
  let identityActor = d.input.identityActorId
    ? await identityActorService.getIdentityActorById({
        identityActorId: d.input.identityActorId,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment
      })
    : null;

  return identityInternalService.ensureIntegrationIdentity({
    tenant: d.tenant,
    solution: d.solution,
    environment: d.environment,
    integrationInstance: d.integrationInstance,
    actor: identityActor,
    identityId: d.input.identityId
  });
};

class integrationInstanceServiceImpl {
  private integrationInstanceCreateData(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    id: ReturnType<typeof getId>;
    input: IntegrationInstanceWriteInput;
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
      integrationOid: d.integration.oid,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid
    };
  }

  private integrationInstanceUpdateData(d: {
    integrationInstance: IntegrationInstance;
    integration: Integration;
    input: IntegrationInstanceWriteInput;
    isMagicMcpBacking?: boolean;
  }) {
    return {
      status: d.isMagicMcpBacking
        ? d.integrationInstance.status === 'deleted'
          ? ('deleted' as const)
          : ('active' as const)
        : undefined,
      isMagicMcpBacking: d.isMagicMcpBacking,
      name: d.input.name.trim(),
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata,
      integrationOid: d.integration.oid
    };
  }

  private async applyIdentityAndProviders(d: {
    db: TransactionDB;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: IntegrationInstanceWriteInput;
    current?: Parameters<typeof mergeIntegrationIdentityInput>[0]['current'];
  }) {
    let mergedIdentityInput = mergeIntegrationIdentityInput({
      current: d.current,
      input: {
        identityActorId: d.input.identityActorId,
        identityId: d.input.identityId
      }
    });
    let { actor, identity } = await resolveIntegrationIdentity({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      integrationInstance: d.integrationInstance,
      input: mergedIdentityInput
    });

    let integrationInstance = await d.db.integrationInstance.update({
      where: { oid: d.integrationInstance.oid },
      data: {
        identityActorOid: actor?.oid ?? null,
        identityOid: identity?.oid ?? null
      },
      include: integrationInstanceInclude
    });

    if (d.input.providers?.length) {
      await integrationInstanceProviderService.setIntegrationInstanceProviders({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationInstance,
        input: d.input.providers
      });

      integrationInstance = await d.db.integrationInstance.findUniqueOrThrow({
        where: { oid: integrationInstance.oid },
        include: integrationInstanceInclude
      });
    }

    return integrationInstance;
  }

  private async getAutomaticProviderInputs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    input: Pick<IntegrationInstanceWriteInput, 'providers'>;
  }) {
    let integrationProviders = await db.integrationProvider.findMany({
      where: {
        integrationOid: d.integration.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: 'active'
      },
      include: {
        provider: {
          include: {
            type: true,
            defaultVariant: true
          }
        },
        currentVersion: {
          include: {
            deployment: true
          }
        }
      }
    });

    let explicitProviderReferences = new Set(
      (d.input.providers ?? []).map(provider => provider.providerId)
    );

    let automaticInputs: SetIntegrationInstanceProviderInput[] = [];
    for (let integrationProvider of integrationProviders) {
      let provider = integrationProvider.provider;
      let deployment = integrationProvider.currentVersion?.deployment;
      if (!deployment) continue;

      if (
        explicitProviderReferences.has(integrationProvider.id) ||
        explicitProviderReferences.has(provider.id)
      ) {
        continue;
      }

      if (
        provider.type.attributes.auth.status !== 'disabled' ||
        provider.type.attributes.config.status !== 'disabled'
      ) {
        continue;
      }

      checkDeletedRelation(integrationProvider);
      checkDeletedRelation(provider);
      checkDeletedRelation(deployment);

      let defaultConfig = await providerConfigService.ensureDefaultEmptyProviderConfig({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider,
        providerDeployment: deployment
      });

      automaticInputs.push({
        providerId: integrationProvider.id,
        providerDeploymentId: deployment.id,
        providerConfigId: defaultConfig.id
      });
    }

    return automaticInputs;
  }

  async listIntegrationInstances(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;
    includeMagicMcpBackings?: boolean;

    status?: IntegrationInstanceStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    integrationIds?: string[];
    providerIds?: string[];
    integrationProviderIds?: string[];
    identityIds?: string[];
    identityCredentialIds?: string[];
    actorIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    sessionTemplateIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let integrations = await resolveIntegrations(d, d.integrationIds);
    let providers = await resolveProviders(d, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(d, d.integrationProviderIds);
    let identities = await resolveIdentities(d, d.identityIds);
    let credentials = await resolveIdentityCredentials(d, d.identityCredentialIds);
    let actors = await resolveIdentityActors(d, d.actorIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.integrationInstance.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationInstance.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isMagicMcpBacking: d.includeMagicMcpBackings ? undefined : false,

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                integrations ? { integrationOid: integrations.in } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers
                  ? {
                      integrationInstanceProviders: {
                        some: { integrationProvider: { providerOid: providers.in } }
                      }
                    }
                  : undefined!,
                integrationProviders
                  ? {
                      integrationInstanceProviders: {
                        some: { integrationProviderOid: integrationProviders.in }
                      }
                    }
                  : undefined!,
                identities
                  ? {
                      OR: [
                        { identityOid: { in: identities.oids } },
                        { ownedIdentities: { some: { oid: { in: identities.oids } } } },
                        {
                          identityCredentials: {
                            some: { identityOid: { in: identities.oids } }
                          }
                        }
                      ]
                    }
                  : undefined!,
                credentials
                  ? { identityCredentials: { some: { oid: { in: credentials.oids } } } }
                  : undefined!,
                actors
                  ? {
                      OR: [
                        { identityActorOid: actors.in },
                        { identity: { actorOid: actors.in } },
                        { ownedIdentities: { some: { actorOid: actors.in } } }
                      ]
                    }
                  : undefined!,
                deployments
                  ? {
                      OR: [
                        {
                          integrationInstanceProviders: {
                            some: {
                              currentVersion: {
                                integrationProviderVersion: { deploymentOid: deployments.in }
                              }
                            }
                          }
                        },
                        { identityCredentials: { some: { deploymentOid: deployments.in } } }
                      ]
                    }
                  : undefined!,
                configs
                  ? {
                      OR: [
                        {
                          integrationInstanceProviders: {
                            some: { currentVersion: { configOid: configs.in } }
                          }
                        },
                        { identityCredentials: { some: { configOid: configs.in } } }
                      ]
                    }
                  : undefined!,
                authConfigs
                  ? {
                      OR: [
                        {
                          integrationInstanceProviders: {
                            some: { currentVersion: { authConfigOid: authConfigs.in } }
                          }
                        },
                        { identityCredentials: { some: { authConfigOid: authConfigs.in } } }
                      ]
                    }
                  : undefined!,
                sessionTemplates
                  ? { sessionTemplates: { some: { oid: sessionTemplates.in } } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationInstanceInclude
          })
      )
    );
  }

  async getIntegrationInstanceById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceId: string;
    allowDeleted?: boolean;
  }) {
    let integrationInstance = await db.integrationInstance.findFirst({
      where: {
        id: d.integrationInstanceId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: integrationInstanceInclude
    });
    if (!integrationInstance)
      throw new ServiceError(notFoundError('integration.instance', d.integrationInstanceId));

    return integrationInstance;
  }

  async createIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      identityActorId?: string | null;
      identityId?: string | null;
      providers?: SetIntegrationInstanceProviderInput[];
    };
  }) {
    checkTenant(d, d.integration);
    checkDeletedRelation(d.integration);

    return await withTransaction(async db => {
      let automaticProviders = await this.getAutomaticProviderInputs({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integration: d.integration,
        input: d.input
      });

      let newId = getId('integrationInstance');
      let integrationInstance = await db.integrationInstance.create({
        data: this.integrationInstanceCreateData({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          integration: d.integration,
          id: newId,
          input: d.input
        }),
        include: integrationInstanceInclude
      });

      integrationInstance = await this.applyIdentityAndProviders({
        db,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationInstance,
        input: {
          ...d.input,
          providers: [...(d.input.providers ?? []), ...automaticProviders]
        }
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceCreatedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

      return integrationInstance;
    });
  }

  async upsertMagicMcpIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    integrationInstance?: IntegrationInstance | null;
    input: {
      name: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      identityActorId?: string | null;
      identityId?: string | null;
    };
  }) {
    checkTenant(d, d.integration);
    checkDeletedRelation(d.integration);

    return await withTransaction(async db => {
      if (d.integrationInstance) checkTenant(d, d.integrationInstance);

      let newId = getId('integrationInstance');
      let integrationInstance = d.integrationInstance
        ? await db.integrationInstance.update({
            where: {
              oid: d.integrationInstance.oid,
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid
            },
            data: this.integrationInstanceUpdateData({
              integrationInstance: d.integrationInstance,
              integration: d.integration,
              input: d.input,
              isMagicMcpBacking: true
            }),
            include: integrationInstanceInclude
          })
        : await db.integrationInstance.create({
            data: this.integrationInstanceCreateData({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integration: d.integration,
              id: newId,
              input: d.input,
              isMagicMcpBacking: true
            }),
            include: integrationInstanceInclude
          });
      let isNew = integrationInstance.id === newId.id;

      integrationInstance = await this.applyIdentityAndProviders({
        db,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationInstance,
        input: d.input,
        current: integrationInstance
      });

      await addAfterTransactionHook(async () => {
        if (isNew) {
          await integrationInstanceCreatedQueue.add({
            integrationInstanceId: integrationInstance.id
          });
        } else {
          await integrationInstanceUpdatedQueue.add({
            integrationInstanceId: integrationInstance.id
          });
        }
      });

      return integrationInstance;
    });
  }

  async updateIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      identityActorId?: string | null;
      identityId?: string | null;
      providers?: SetIntegrationInstanceProviderInput[];
    };
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedEdit(d.integrationInstance, 'update');

    let current = await db.integrationInstance.findUniqueOrThrow({
      where: { oid: d.integrationInstance.oid },
      include: {
        identityActor: {
          select: { id: true }
        },
        identity: {
          select: { id: true }
        }
      }
    });
    let mergedIdentityInput = mergeIntegrationIdentityInput({
      current,
      input: {
        identityActorId: d.input.identityActorId,
        identityId: d.input.identityId
      }
    });
    let { actor, identity } = await resolveIntegrationIdentity({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      integrationInstance: d.integrationInstance,
      input: mergedIdentityInput
    });

    return await withTransaction(async db => {
      let integrationInstance = await db.integrationInstance.update({
        where: {
          oid: d.integrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.integrationInstance.name,
          description:
            d.input.description === undefined
              ? d.integrationInstance.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined ? d.integrationInstance.metadata : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.integrationInstance.privateMetadata
              : d.input.privateMetadata,
          identityActorOid: actor?.oid ?? null,
          identityOid: identity?.oid ?? null
        },
        include: integrationInstanceInclude
      });

      if (d.input.providers?.length) {
        await integrationInstanceProviderService.setIntegrationInstanceProviders({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          integrationInstance,
          input: d.input.providers
        });

        integrationInstance = await db.integrationInstance.findUniqueOrThrow({
          where: { oid: integrationInstance.oid },
          include: integrationInstanceInclude
        });
      }

      await addAfterTransactionHook(async () =>
        integrationInstanceUpdatedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

      return integrationInstance;
    });
  }

  async createSessionTemplateForIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedRelation(d.integrationInstance);

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
          integrationInstanceOid: d.integrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: linkedSessionTemplateInclude
      });

      await addAfterTransactionHook(async () =>
        syncIntegrationInstanceSessionTemplateQueue.add({
          sessionTemplateId: sessionTemplate.id
        })
      );

      return sessionTemplate;
    });
  }

  async archiveIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    _canModifyMagicMcpBacking?: boolean;
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedEdit(d.integrationInstance, 'archive');
    if (d.integrationInstance.isMagicMcpBacking && !d._canModifyMagicMcpBacking) {
      throw new ServiceError(
        badRequestError({
          message: 'Magic MCP backed integration instances cannot be deleted directly.',
          code: 'magic_mcp_backing_integration_instance_delete_blocked'
        })
      );
    }

    return await withTransaction(async db => {
      let integrationInstance = await db.integrationInstance.update({
        where: {
          oid: d.integrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include: integrationInstanceInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceArchivedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

      return integrationInstance;
    });
  }

  async deleteIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
  }) {
    return await this.archiveIntegrationInstance(d);
  }
}

export let integrationInstanceService = Service.create(
  'integrationInstance',
  () => new integrationInstanceServiceImpl()
).build();
