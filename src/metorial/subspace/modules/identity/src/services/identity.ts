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
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { Fabric, type AuditSubspaceIdentity } from '@metorial/fabric';
import {
  assertNoActiveIntegrationIdentityLink,
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
import {
  checkTenant,
  getMetorialSolution,
  metorialDb,
  type MetorialFacing,
  toProviderEventBase,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
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

export type ListIdentitiesParams = {
  tenant: Tenant;
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
};

export type GetIdentityByIdParams = {
  tenant: Tenant;
  environment: Environment;
  identityId: string;
  allowDeleted?: boolean;
};

export type CreateIdentityParams = {
  tenant: Tenant;
  environment: Environment;

  actor: IdentityActor;

  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;

    inputs: IdentityCredentialInput[];
  };
};

export type UpdateIdentityParams = {
  tenant: Tenant;
  environment: Environment;
  identity: Identity;

  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  };
};

export type UpdateIdentityFacingParams = Omit<UpdateIdentityParams, 'identity'> & {
  identity: UpdateIdentityParams['identity'] & AuditSubspaceIdentity;
};

export type ArchiveIdentityParams = {
  tenant: Tenant;
  environment: Environment;
  identity: Identity;
};

class identityServiceImpl {
  async listIdentities(d: MetorialFacing<ListIdentitiesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listIdentitiesInternal({ ...rest, tenant, environment });
  }

  async listIdentitiesInternal(d: ListIdentitiesParams) {
    let solution = await getMetorialSolution();
    let scope = { ...d, solution };

    let agents = await resolveAgents(scope, d.agentIds);
    let actors = await resolveIdentityActors(scope, d.actorIds);
    let identities = await resolveIdentities(scope, d.identityIds);
    let credentials = await resolveIdentityCredentials(scope, d.identityCredentialIds);
    let integrations = await resolveIntegrations(scope, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(
      scope,
      d.integrationInstanceIds
    );
    let integrationInstanceProviders = await resolveIntegrationInstanceProviders(
      scope,
      d.integrationInstanceProviderIds
    );
    let providers = await resolveProviders(scope, d.providerIds);
    let deployments = await resolveProviderDeployments(scope, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(scope, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(scope, d.providerAuthConfigIds);

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
              solutionOid: solution.oid,
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

  async getIdentityById(d: MetorialFacing<GetIdentityByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getIdentityByIdInternal({ ...rest, tenant, environment });
  }

  async getIdentityByIdInternal(d: GetIdentityByIdParams) {
    let solution = await getMetorialSolution();
    let identity = await db.identity.findFirst({
      where: {
        id: d.identityId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!identity) throw new ServiceError(notFoundError('identity', d.identityId));

    return identity;
  }

  async createIdentity(d: MetorialFacing<CreateIdentityParams> & { actor: IdentityActor }) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.created:before', eventBase);

    let identity = await this.createIdentityInternal({ ...rest, tenant, environment });

    await Fabric.fire('identity.created:after', {
      ...eventBase,
      identity
    });

    return identity;
  }

  async createIdentityInternal(d: CreateIdentityParams) {
    let solution = await getMetorialSolution();

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
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid
        }
      });

      await identityCredentialService.internalCreateIdentityCredentials({
        tenant: d.tenant,
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

  async updateIdentity(d: MetorialFacing<UpdateIdentityFacingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.updated:before', eventBase);

    let identity = await this.updateIdentityInternal({ ...rest, tenant, environment });

    await Fabric.fire('identity.updated:after', {
      ...eventBase,
      identity,
      previousIdentity: d.identity
    });

    return identity;
  }

  async updateIdentityInternal(d: UpdateIdentityParams) {
    checkTenant(d, d.identity);
    checkDeletedEdit(d.identity, 'update');

    return withTransaction(async db => {
      let identity = await db.identity.update({
        where: {
          oid: d.identity.oid,
          tenantOid: d.tenant.oid,
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

  async archiveIdentity(
    d: MetorialFacing<ArchiveIdentityParams> & { canEditConsumerActor?: boolean }
  ) {
    let { instance, organizationActor, canEditConsumerActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });

    if (!canEditConsumerActor) {
      let consumerActor = await metorialDb.consumerActor.findFirst({
        where: {
          defaultIdentityId: rest.identity.id,
          instanceOid: instance.oid
        }
      });
      if (consumerActor) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete identity linked to consumer'
          })
        );
      }
    }

    return this.archiveIdentityInternal({ ...rest, tenant, environment });
  }

  async archiveIdentityInternal(d: ArchiveIdentityParams) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.identity);
    checkDeletedEdit(d.identity, 'archive');

    await assertNoActiveIntegrationIdentityLink({
      tenant: d.tenant,
      solution,
      environment: d.environment,
      identityOid: d.identity.oid,
      identityId: d.identity.id,
      ownedByIntegrationInstanceOid: d.identity.ownedByIntegrationInstanceOid
    });

    return withTransaction(async db => {
      let identity = await db.identity.update({
        where: {
          oid: d.identity.oid,
          tenantOid: d.tenant.oid,
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
