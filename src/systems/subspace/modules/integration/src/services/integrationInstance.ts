import { notFoundError, ServiceError } from '@lowerdeck/error';
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
  }
} as const;

let linkedSessionTemplateInclude = {
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

type IntegrationIdentityInput = {
  identityActorId?: string | null;
  identityId?: string | null;
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
  async listIntegrationInstances(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

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

    let mergedIdentityInput = mergeIntegrationIdentityInput({
      input: {
        identityActorId: d.input.identityActorId,
        identityId: d.input.identityId
      }
    });

    return await withTransaction(async db => {
      let integrationInstance = await db.integrationInstance.create({
        data: {
          ...getId('integrationInstance'),
          status: 'draft',
          name: d.input.name.trim(),
          description: d.input.description?.trim(),
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          integrationOid: d.integration.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: integrationInstanceInclude
      });

      let { actor, identity } = await resolveIntegrationIdentity({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationInstance,
        input: mergedIdentityInput
      });
      integrationInstance = await db.integrationInstance.update({
        where: { oid: integrationInstance.oid },
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

        integrationInstance = await db.integrationInstance.findUniqueOrThrow({
          where: { oid: integrationInstance.oid },
          include: integrationInstanceInclude
        });
      }

      await addAfterTransactionHook(async () =>
        integrationInstanceCreatedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

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
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedEdit(d.integrationInstance, 'archive');

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
