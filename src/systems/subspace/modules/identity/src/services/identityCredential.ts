import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Identity,
  type IdentityCredential,
  type IdentityCredentialStatus,
  type IdentityDelegationConfig,
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
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  type ProviderCombinationInput,
  providerCombinationService
} from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  identityCredentialCreatedQueue,
  identityCredentialDeletedQueue,
  identityCredentialUpdatedQueue
} from '../queues/lifecycle/identityCredential';

export type IdentityCredentialInput = ProviderCombinationInput & {
  delegationConfigId?: string;
  privateMetadata?: Record<string, any>;
};

let include = {
  identity: true,
  provider: true,
  deployment: true,
  config: true,
  authConfig: true,
  delegationConfig: true
};

class identityCredentialServiceImpl {
  async listIdentityCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: IdentityCredentialStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    agentIds?: string[];
    actorIds?: string[];
    identityIds?: string[];
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
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityCredential.findMany({
            ...opts,
            where: {
              identity: {
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                environmentOid: d.environment.oid,

                ...normalizeStatusForList(d).hasParent
              },

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                agents ? { identity: { actor: { agent: agents.oidIn } } } : undefined!,
                actors ? { identity: { actor: actors.oidIn } } : undefined!,

                identities ? { identityOid: { in: identities.oids } } : undefined!,

                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                configs ? { configOid: configs.in } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityCredentialById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityCredentialId: string;
    allowDeleted?: boolean;
  }) {
    let identityCredential = await db.identityCredential.findFirst({
      where: {
        id: d.identityCredentialId,

        ...normalizeStatusForGet(d).noParent,

        identity: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          ...normalizeStatusForGet(d).hasParent
        }
      },
      include
    });
    if (!identityCredential)
      throw new ServiceError(notFoundError('identity.credential', d.identityCredentialId));

    return identityCredential;
  }

  async createIdentityCredential(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    identity: Identity;

    input: IdentityCredentialInput;
  }) {
    checkTenant(d, d.identity);
    checkDeletedRelation(d.identity);

    return withTransaction(async db => {
      let existingCredentials = await db.identityCredential.findMany({
        where: {
          identityOid: d.identity.oid,
          status: 'active'
        }
      });
      if (existingCredentials.length >= 100) {
        throw new ServiceError(
          badRequestError({
            message: 'An identity cannot have more than 100 active credentials'
          })
        );
      }

      let [identityCredential] = await this.internalCreateIdentityCredentials({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        identity: d.identity,
        inputs: [d.input]
      });

      await db.identity.updateMany({
        where: { oid: d.identity.oid },
        data: { needsReconciliation: true }
      });

      await addAfterTransactionHook(async () =>
        identityCredentialCreatedQueue.add({ identityCredentialId: identityCredential!.id })
      );

      return identityCredential!;
    });
  }

  async updateIdentityCredential(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityCredential: IdentityCredential & { identity: Identity };

    input: {
      delegationConfig: IdentityDelegationConfig;
    };
  }) {
    checkTenant(d, d.identityCredential.identity);
    checkDeletedEdit(d.identityCredential, 'update');
    checkDeletedEdit(d.identityCredential.identity, 'update');

    return withTransaction(async db => {
      let identityCredential = await db.identityCredential.update({
        where: {
          oid: d.identityCredential.oid
        },
        data: {
          delegationConfigOid: d.input.delegationConfig.oid
        },
        include
      });

      await db.identity.updateMany({
        where: { oid: d.identityCredential.identity.oid },
        data: { needsReconciliation: true }
      });

      await addAfterTransactionHook(async () =>
        identityCredentialUpdatedQueue.add({ identityCredentialId: identityCredential.id })
      );

      return identityCredential;
    });
  }

  async archiveIdentityCredential(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityCredential: IdentityCredential & { identity: Identity };
  }) {
    checkTenant(d, d.identityCredential.identity);
    checkDeletedEdit(d.identityCredential, 'archive');
    checkDeletedEdit(d.identityCredential.identity, 'archive');

    let activeIntegrationInstanceProvider = d.identityCredential.integrationInstanceProviderOid
      ? await db.integrationInstanceProvider.findFirst({
          where: {
            oid: d.identityCredential.integrationInstanceProviderOid,
            status: 'active',
            isParentDeleted: false
          },
          select: {
            id: true,
            name: true
          }
        })
      : null;
    if (activeIntegrationInstanceProvider) {
      throw new ServiceError(
        badRequestError({
          message:
            'Identity credential is linked to an active integration instance provider and cannot be deleted.',
          code: 'identity_credential_in_use_by_active_integration_instance_provider',
          data: {
            integrationInstanceProviderId: activeIntegrationInstanceProvider.id,
            integrationInstanceProviderName: activeIntegrationInstanceProvider.name
          }
        })
      );
    }

    return withTransaction(async db => {
      let identityCredential = await db.identityCredential.update({
        where: {
          oid: d.identityCredential.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include
      });

      await db.identity.updateMany({
        where: { oid: d.identityCredential.identity.oid },
        data: { needsReconciliation: true }
      });

      await addAfterTransactionHook(async () =>
        identityCredentialDeletedQueue.add({ identityCredentialId: identityCredential.id })
      );

      return identityCredential;
    });
  }

  async internalCreateIdentityCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    identity: Identity;
    inputs: IdentityCredentialInput[];
  }) {
    return withTransaction(async db => {
      let delegationConfigIds = d.inputs.map(i => i.delegationConfigId!).filter(Boolean);

      let delegationConfigs = delegationConfigIds.length
        ? await db.identityDelegationConfig.findMany({
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              id: { in: delegationConfigIds }
            }
          })
        : [];

      for (let delegationConfig of delegationConfigs) {
        checkTenant(d, delegationConfig);
        checkDeletedRelation(delegationConfig);
      }

      let delegationConfigMap = new Map(delegationConfigs.map(c => [c.id, c]));

      let combination = await providerCombinationService.getCombinations({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        providers: d.inputs
      });

      return await db.identityCredential.createManyAndReturn({
        data: combination.map((c, i) => {
          let input = d.inputs[i];

          let delegationConfig = input.delegationConfigId
            ? delegationConfigMap.get(input.delegationConfigId)
            : null;

          return {
            ...getId('identityCredential'),

            status: 'active',

            identityOid: d.identity.oid,

            authConfigOid: c.authConfig?.oid,
            configOid: c.config.oid,
            deploymentOid: c.deployment.oid,
            providerOid: c.provider.oid,

            privateMetadata: input.privateMetadata,

            delegationConfigOid: delegationConfig?.oid
          };
        }),
        include
      });
    });
  }
}

export let identityCredentialService = Service.create(
  'identityCredential',
  () => new identityCredentialServiceImpl()
).build();
