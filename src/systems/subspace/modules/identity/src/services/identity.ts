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
  type IdentityStatus,
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
  resolveAgents,
  resolveIdentities,
  resolveIdentityActors,
  resolveIdentityCredentials,
  resolveIntegrationInstanceProviders,
  resolveIntegrationInstances,
  resolveIntegrations,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  identityCreatedQueue,
  identityDeletedQueue,
  identityUpdatedQueue
} from '../queues/lifecycle/identity';
import { type IdentityCredentialInput, identityCredentialService } from './identityCredential';

let include = {
  ownedByIntegrationInstance: {
    select: {
      id: true
    }
  },
  actor: {
    include: {
      agent: true
    }
  },
  delegationConfig: true,
  credentials: {
    include: {
      identity: true,
      provider: true,
      deployment: true,
      config: true,
      authConfig: true,
      delegationConfig: true,
      integrationInstance: true,
      integrationInstanceProvider: true
    }
  }
} as const;

class identityServiceImpl {
  async listIdentities(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: IdentityStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    agentIds?: string[];
    actorIds?: string[];
    identityIds?: string[];
    identityCredentialIds?: string[];
    integrationIds?: string[];
    integrationInstanceIds?: string[];
    integrationInstanceProviderIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let agents = await resolveAgents(d, d.agentIds);
    let actors = await resolveIdentityActors(d, d.actorIds);
    let identities = await resolveIdentities(d, d.identityIds);
    let credentials = await resolveIdentityCredentials(d, d.identityCredentialIds);
    let integrations = await resolveIntegrations(d, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(d, d.integrationInstanceIds);
    let integrationInstanceProviders = await resolveIntegrationInstanceProviders(
      d,
      d.integrationInstanceProviderIds
    );
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.identity.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identity.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                identities ? { oid: { in: identities.oids } } : undefined!,

                agents ? { actor: { agent: agents.oidIn } } : undefined!,
                actors ? { actor: actors.oidIn } : undefined!,
                credentials
                  ? { credentials: { some: { oid: { in: credentials.oids } } } }
                  : undefined!,
                integrations
                  ? {
                      OR: [
                        {
                          integrationInstances: { some: { integrationOid: integrations.in } }
                        },
                        {
                          ownedByIntegrationInstance: {
                            is: { integrationOid: integrations.in }
                          }
                        }
                      ]
                    }
                  : undefined!,
                integrationInstances
                  ? {
                      OR: [
                        { integrationInstances: { some: { oid: integrationInstances.in } } },
                        { ownedByIntegrationInstanceOid: integrationInstances.in }
                      ]
                    }
                  : undefined!,
                integrationInstanceProviders
                  ? {
                      credentials: {
                        some: {
                          integrationInstanceProviderOid: integrationInstanceProviders.in
                        }
                      }
                    }
                  : undefined!,
                providers
                  ? { credentials: { some: { providerOid: providers.in } } }
                  : undefined!,
                deployments
                  ? { credentials: { some: { deploymentOid: deployments.in } } }
                  : undefined!,
                configs ? { credentials: { some: { configOid: configs.in } } } : undefined!,
                authConfigs
                  ? { credentials: { some: { authConfigOid: authConfigs.in } } }
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

  async getIdentityById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityId: string;
    allowDeleted?: boolean;
  }) {
    let identity = await db.identity.findFirst({
      where: {
        id: d.identityId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!identity) throw new ServiceError(notFoundError('identity', d.identityId));

    return identity;
  }

  async createIdentity(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    actor: IdentityActor;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;

      inputs: IdentityCredentialInput[];
    };
  }) {
    checkTenant(d, d.actor);
    checkDeletedRelation(d.actor);

    return withTransaction(async db => {
      let identity = await db.identity.create({
        data: {
          ...getId('identity'),

          status: 'active',

          needsReconciliation: true,

          actorOid: d.actor.oid,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      });

      await identityCredentialService.internalCreateIdentityCredentials({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,

        identity,
        inputs: d.input.inputs
      });

      await addAfterTransactionHook(async () =>
        identityCreatedQueue.add({ identityId: identity.id })
      );

      return await db.identity.findFirstOrThrow({
        where: { oid: identity.oid },
        include
      });
    });
  }

  async updateIdentity(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.identity);
    checkDeletedEdit(d.identity, 'update');

    return withTransaction(async db => {
      let identity = await db.identity.update({
        where: {
          oid: d.identity.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.identity.name,
          description: d.input.description ?? d.identity.description,
          metadata: d.input.metadata ?? d.identity.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityUpdatedQueue.add({ identityId: identity.id })
      );

      return identity;
    });
  }

  async archiveIdentity(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;
  }) {
    checkTenant(d, d.identity);
    checkDeletedEdit(d.identity, 'archive');

    let activeIntegrationInstance = await db.integrationInstance.findFirst({
      where: {
        status: 'active',
        OR: [
          { identityOid: d.identity.oid },
          { oid: d.identity.ownedByIntegrationInstanceOid ?? -1n }
        ]
      },
      select: {
        id: true,
        name: true
      }
    });
    if (activeIntegrationInstance) {
      throw new ServiceError(
        badRequestError({
          message:
            'Identity is linked to an active integration instance and cannot be deleted.',
          code: 'identity_in_use_by_active_integration_instance',
          data: {
            integrationInstanceId: activeIntegrationInstance.id,
            integrationInstanceName: activeIntegrationInstance.name
          }
        })
      );
    }

    return withTransaction(async db => {
      let identity = await db.identity.update({
        where: {
          oid: d.identity.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          needsReconciliation: true
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityDeletedQueue.add({ identityId: identity.id })
      );

      return identity;
    });
  }
}

export let identityService = Service.create(
  'identity',
  () => new identityServiceImpl()
).build();
