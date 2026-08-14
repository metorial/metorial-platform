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
import { sessionService, sessionTemplateService, finalizeSessionCreate } from '@metorial-subspace/module-session';
import { enqueueSyncIntegrationInstanceSessionTemplate } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedSessionTemplate';
import { type SessionProviderTemplateInput } from '@metorial-subspace/module-session/src/services/sessionProviderInput';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { integrationProviderVersionInclude } from '../lib/integrationIncludes';
import {
  integrationInstanceArchivedQueue,
  integrationInstanceCreatedQueue,
  integrationInstanceUpdatedQueue
} from '../queues/lifecycle/integrationInstance';
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
  defaultSessionTemplate: true,
  magicMcpServerBackings: {
    orderBy: {
      createdAt: 'asc' as const
    },
    take: 1,
    select: {
      id: true
    }
  },
  integrationInstanceProviders: {
    where: { status: 'active' as const, isParentDeleted: false },
    include: integrationInstanceProviderInclude
  }
} as const;

export let magicMcpBackingIntegrationInstanceInclude = {
  integration: true,
  identityActor: true,
  identity: true
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

let DEFAULT_SESSION_TEMPLATE_POLL_INTERVAL_MS = 250;
let DEFAULT_SESSION_TEMPLATE_POLL_ATTEMPTS = 20;

let wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let defaultSessionTemplateTimeoutError = () =>
  badRequestError({
    message: 'Timed out waiting for the default session template to become available.',
    code: 'default_session_template_timeout'
  });

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
  environment: Environment;
  integrationInstance: IntegrationInstance;
  input: {
    identityActorId: string | null;
    identityId: string | null;
  };
}) => {
  let identityActor = d.input.identityActorId
    ? await identityActorService.getIdentityActorByIdInternal({
        identityActorId: d.input.identityActorId,
        tenant: d.tenant,
        environment: d.environment
      })
    : null;

  return identityInternalService.ensureIntegrationIdentity({
    tenant: d.tenant,
    environment: d.environment,
    integrationInstance: d.integrationInstance,
    actor: identityActor,
    identityId: d.input.identityId
  });
};

export type ListIntegrationInstancesParams = {
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
};

export type GetIntegrationInstanceByIdParams = {
  integrationInstanceId: string;
  allowDeleted?: boolean;
};

export type CreateIntegrationInstanceParams = {
  integration: Integration;
  isHiddenDraft?: boolean;
  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    identityActorId?: string | null;
    identityId?: string | null;
    providers?: SetIntegrationInstanceProviderInput[];
  };
};

export type UpsertMagicMcpIntegrationInstanceParams = {
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
};

export type UpdateIntegrationInstanceParams = {
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
};

export type CreateSessionTemplateForIntegrationInstanceParams = {
  integrationInstance: IntegrationInstance;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  };
};

export type WaitForDefaultSessionTemplateForIntegrationInstanceParams = {
  integrationInstance: IntegrationInstance;
};

export type CreateSessionForIntegrationInstanceParams = {
  integrationInstance: IntegrationInstance;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  };
};

export type ArchiveIntegrationInstanceParams = {
  integrationInstance: IntegrationInstance;
  _canModifyMagicMcpBacking?: boolean;
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
    isHiddenDraft?: boolean;
  }) {
    return {
      ...d.id,
      status: 'draft' as const,
      isHiddenDraft: d.isHiddenDraft ?? false,
      isMagicMcpBacking: !!d.isMagicMcpBacking,
      name: d.input.name.trim(),
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata,
      integrationOid: d.integration.oid,
      tenantOid: d.tenant.oid,
      projectOid: d.tenant.projectOid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      instanceOid: d.environment.instanceOid
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
    tenant: Tenant;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: IntegrationInstanceWriteInput;
    current?: Parameters<typeof mergeIntegrationIdentityInput>[0]['current'];
    isMagicMcpBacking?: boolean;
  }) {
    return withTransaction(async db => {
      let mergedIdentityInput = mergeIntegrationIdentityInput({
        current: d.current,
        input: {
          identityActorId: d.input.identityActorId,
          identityId: d.input.identityId
        }
      });
      let { actor, identity } = await resolveIntegrationIdentity({
        tenant: d.tenant,
        environment: d.environment,
        integrationInstance: d.integrationInstance,
        input: mergedIdentityInput
      });

      let integrationInstance = await db.integrationInstance.update({
        where: { oid: d.integrationInstance.oid },
        data: {
          identityActorOid: actor?.oid ?? null,
          identityOid: identity?.oid ?? null
        },
        include: integrationInstanceInclude
      });

      if (d.input.providers?.length) {
        await integrationInstanceProviderService.setIntegrationInstanceProvidersInternal({
          tenant: d.tenant,
          environment: d.environment,
          integrationInstance,
          input: d.input.providers
        });

        integrationInstance = await db.integrationInstance.findUniqueOrThrow({
          where: { oid: integrationInstance.oid },
          include: integrationInstanceInclude
        });
      }

      return integrationInstance;
    }, { ifExists: true });
  }

  private async getAutomaticProviderInputs(d: {
    tenant: Tenant;
    environment: Environment;
    integration: Integration;
    input: Pick<IntegrationInstanceWriteInput, 'providers'>;
  }) {
    let solution = await getMetorialSolution();

    let integrationProviders = await db.integrationProvider.findMany({
      where: {
        integrationOid: d.integration.oid,
        tenantOid: d.tenant.oid,
        solution,
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
            deployment: true,
            config: true
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
      let sharedConfig = integrationProvider.currentVersion?.config;
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

      let providerConfigId: string | null;
      if (sharedConfig) {
        providerConfigId = null;
      } else {
        let materialDeployment = await db.providerDeployment.findFirstOrThrow({
          where: {
            oid: deployment.oid,
            tenantOid: d.tenant.oid,
            solution,
            environmentOid: d.environment.oid
          },
          include: {
            provider: true,
            providerVariant: true,
            currentVersion: {
              include: { lockedVersion: true }
            }
          }
        });

        let emptyConfig = await providerConfigService.createProviderConfigInternal({
          tenant: d.tenant,
          environment: d.environment,
          provider,
          providerDeployment: materialDeployment,
          input: {
            name: `${integrationProvider.name} Config`,
            description: 'Auto-created for integration instance',
            config: { type: 'inline', data: {} }
          }
        });
        providerConfigId = emptyConfig.id;
      }

      automaticInputs.push({
        providerId: integrationProvider.id,
        providerDeploymentId: deployment.id,
        providerConfigId
      });
    }

    return automaticInputs;
  }

  async listIntegrationInstances(d: MetorialFacing<ListIntegrationInstancesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listIntegrationInstancesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listIntegrationInstancesInternal(
    d: { tenant: Tenant; environment: Environment } & ListIntegrationInstancesParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let integrations = await resolveIntegrations(ts, d.integrationIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(ts, d.integrationProviderIds);
    let identities = await resolveIdentities(ts, d.identityIds);
    let credentials = await resolveIdentityCredentials(ts, d.identityCredentialIds);
    let actors = await resolveIdentityActors(ts, d.actorIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);
    let sessionTemplates = await resolveSessionTemplates(ts, d.sessionTemplateIds);
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
              solution,
              environmentOid: d.environment.oid,
              isMagicMcpBacking:
                d.includeMagicMcpBackings || integrations?.oids.length ? undefined : false,
              isHiddenDraft: false,

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

  async getIntegrationInstanceById(d: MetorialFacing<GetIntegrationInstanceByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getIntegrationInstanceByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getIntegrationInstanceByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetIntegrationInstanceByIdParams
  ) {
    let solution = await getMetorialSolution();

    let integrationInstance = await db.integrationInstance.findFirst({
      where: {
        id: d.integrationInstanceId,
        tenantOid: d.tenant.oid,
        solution,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: integrationInstanceInclude
    });
    if (!integrationInstance)
      throw new ServiceError(notFoundError('integration.instance', d.integrationInstanceId));

    return integrationInstance;
  }

  async createIntegrationInstance(d: MetorialFacing<CreateIntegrationInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.integration_instance.created:before', eventBase);

    let integrationInstance = await this.createIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.integration_instance.created:after', {
      ...eventBase,
      integrationInstance
    });

    return integrationInstance;
  }

  async createIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & CreateIntegrationInstanceParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integration);
    checkDeletedRelation(d.integration);

    return await withTransaction(async db => {
      let automaticProviders = await this.getAutomaticProviderInputs({
        tenant: d.tenant,
        environment: d.environment,
        integration: d.integration,
        input: d.input
      });

      let newId = getId('integrationInstance');
      let integrationInstance = await db.integrationInstance.create({
        data: this.integrationInstanceCreateData({
          tenant: d.tenant,
          solution,
          environment: d.environment,
          integration: d.integration,
          id: newId,
          input: d.input,
          isHiddenDraft: d.isHiddenDraft
        }),
        include: integrationInstanceInclude
      });

      integrationInstance = await this.applyIdentityAndProviders({
        tenant: d.tenant,
        environment: d.environment,
        integrationInstance,
        input: {
          ...d.input,
          providers: [...(d.input.providers ?? []), ...automaticProviders]
        }
      });

      integrationInstance = await db.integrationInstance.findUniqueOrThrow({
        where: { oid: integrationInstance.oid },
        include: integrationInstanceInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceCreatedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

      return integrationInstance;
    });
  }

  async upsertMagicMcpIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & UpsertMagicMcpIntegrationInstanceParams
  ) {
    let solution = await getMetorialSolution();

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
              solution,
              environmentOid: d.environment.oid
            },
            data: this.integrationInstanceUpdateData({
              integrationInstance: d.integrationInstance,
              integration: d.integration,
              input: d.input,
              isMagicMcpBacking: true
            }),
            include: magicMcpBackingIntegrationInstanceInclude
          })
        : await db.integrationInstance.create({
            data: this.integrationInstanceCreateData({
              tenant: d.tenant,
              solution,
              environment: d.environment,
              integration: d.integration,
              id: newId,
              input: d.input,
              isMagicMcpBacking: true
            }),
            include: magicMcpBackingIntegrationInstanceInclude
          });
      let isNew = integrationInstance.id === newId.id;

      integrationInstance = await this.applyIdentityAndProviders({
        tenant: d.tenant,
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

  async updateIntegrationInstance(d: MetorialFacing<UpdateIntegrationInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateIntegrationInstanceParams
  ) {
    let solution = await getMetorialSolution();

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
      environment: d.environment,
      integrationInstance: d.integrationInstance,
      input: mergedIdentityInput
    });

    return await withTransaction(async db => {
      let integrationInstance = await db.integrationInstance.update({
        where: {
          oid: d.integrationInstance.oid,
          tenantOid: d.tenant.oid,
          solution,
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
        await integrationInstanceProviderService.setIntegrationInstanceProvidersInternal({
          tenant: d.tenant,
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

  async createSessionTemplateForIntegrationInstance(
    d: MetorialFacing<CreateSessionTemplateForIntegrationInstanceParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.createSessionTemplateForIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createSessionTemplateForIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & CreateSessionTemplateForIntegrationInstanceParams
  ) {
    checkTenant(d, d.integrationInstance);
    checkDeletedRelation(d.integrationInstance);

    return await withTransaction(async db => {
      let currentIntegrationInstance = await db.integrationInstance.findUniqueOrThrow({
        where: { oid: d.integrationInstance.oid },
        include: {
          defaultSessionTemplate: true
        }
      });

      let sessionTemplate =
        await sessionTemplateService.upsertInternalLinkedSessionTemplateInternal({
          tenant: d.tenant,
          environment: d.environment,
          sessionTemplate: currentIntegrationInstance.defaultSessionTemplate,
          input: {
            name: d.input.name,
            description: d.input.description,
            metadata: d.input.metadata,
            privateMetadata: d.input.privateMetadata,
            integrationInstance: d.integrationInstance
          }
        });

      await addAfterTransactionHook(async () =>
        enqueueSyncIntegrationInstanceSessionTemplate(sessionTemplate.id)
      );

      return sessionTemplate;
    });
  }

  async waitForDefaultSessionTemplateForIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & WaitForDefaultSessionTemplateForIntegrationInstanceParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integrationInstance);
    checkDeletedRelation(d.integrationInstance);

    for (let attempt = 0; attempt < DEFAULT_SESSION_TEMPLATE_POLL_ATTEMPTS; attempt++) {
      let integrationInstance = await db.integrationInstance.findFirst({
        where: {
          oid: d.integrationInstance.oid,
          tenantOid: d.tenant.oid,
          solution,
          environmentOid: d.environment.oid,
          status: { notIn: ['archived', 'deleted'] }
        },
        include: {
          integrationInstanceProviders: {
            where: {
              status: 'active',
              isParentDeleted: false,
              currentVersion: { configOid: { not: null } }
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

      let template = integrationInstance?.defaultSessionTemplate;
      let expectedProviderCount =
        integrationInstance?.integrationInstanceProviders.length ?? 0;
      if (template && template.providers.length >= expectedProviderCount) {
        return template as SessionProviderTemplateInput;
      }

      if (attempt < DEFAULT_SESSION_TEMPLATE_POLL_ATTEMPTS - 1) {
        await wait(DEFAULT_SESSION_TEMPLATE_POLL_INTERVAL_MS);
      }
    }

    throw new ServiceError(defaultSessionTemplateTimeoutError());
  }

  async createSessionForIntegrationInstance(
    d: MetorialFacing<CreateSessionForIntegrationInstanceParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let session = await this.createSessionForIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return await finalizeSessionCreate({
      instance,
      session
    });
  }

  async createSessionForIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & CreateSessionForIntegrationInstanceParams
  ) {
    checkTenant(d, d.integrationInstance);
    checkDeletedRelation(d.integrationInstance);

    let template = await this.waitForDefaultSessionTemplateForIntegrationInstanceInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationInstance: d.integrationInstance
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

  async archiveIntegrationInstance(d: MetorialFacing<ArchiveIntegrationInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.integration_instance.deleted:before', eventBase);

    let integrationInstance = await this.archiveIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.integration_instance.deleted:after', {
      ...eventBase,
      integrationInstance
    });

    return integrationInstance;
  }

  async archiveIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveIntegrationInstanceParams
  ) {
    let solution = await getMetorialSolution();

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
          solution,
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

  async deleteIntegrationInstance(d: MetorialFacing<ArchiveIntegrationInstanceParams>) {
    return await this.archiveIntegrationInstance(d);
  }

  async deleteIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveIntegrationInstanceParams
  ) {
    return await this.archiveIntegrationInstanceInternal(d);
  }
}

export let integrationInstanceService = Service.create(
  'integrationInstance',
  () => new integrationInstanceServiceImpl()
).build();
