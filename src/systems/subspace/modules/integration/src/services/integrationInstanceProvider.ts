import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type IntegrationInstance,
  type IntegrationInstanceProvider,
  type IntegrationInstanceProviderStatus,
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
  resolveIntegrationInstances,
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerCombinationService } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  createIntegrationInstanceProviderVersion,
  normalizeIntegrationProviderToolFilter,
  refreshIntegrationInstanceStatus
} from '../lib/versions';
import { integrationInstanceProviderSetQueue } from '../queues/lifecycle/integrationInstanceProvider';
import {
  integrationInstanceProviderInclude,
  integrationInstanceProviderVersionInclude
} from './integrationInstance';

let requireCurrentIntegrationProviderVersion = async (integrationProviderOid: bigint) => {
  let integrationProvider = await db.integrationProvider.findUniqueOrThrow({
    where: { oid: integrationProviderOid },
    include: {
      integration: { include: { currentVersion: true } },
      provider: true,
      currentVersion: {
        include: {
          deployment: true,
          config: true
        }
      }
    }
  });

  if (!integrationProvider.currentVersion || !integrationProvider.integration.currentVersion) {
    throw new ServiceError(
      badRequestError({
        message: 'Integration provider has no active version.',
        code: 'integration_provider_version_required'
      })
    );
  }

  return integrationProvider;
};

export type SetIntegrationInstanceProviderInput = {
  providerId: string;
  providerConfigId?: string;
  providerAuthConfigId?: string;
  toolFilters?: PrismaJson.ToolFilter | null;
};

class integrationInstanceProviderServiceImpl {
  async listIntegrationInstanceProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: IntegrationInstanceProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    integrationIds?: string[];
    integrationInstanceIds?: string[];
    providerIds?: string[];
    integrationProviderIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let integrations = await resolveIntegrations(d, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(d, d.integrationInstanceIds);
    let providers = await resolveProviders(d, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(d, d.integrationProviderIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationInstanceProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                integrations ? { integrationOid: integrations.in } : undefined!,
                integrationInstances
                  ? { integrationInstanceOid: integrationInstances.in }
                  : undefined!,
                providers
                  ? { integrationProvider: { providerOid: providers.in } }
                  : undefined!,
                integrationProviders
                  ? { integrationProviderOid: integrationProviders.in }
                  : undefined!,
                deployments
                  ? {
                      currentVersion: {
                        integrationProviderVersion: { deploymentOid: deployments.in }
                      }
                    }
                  : undefined!,
                configs ? { currentVersion: { configOid: configs.in } } : undefined!,
                authConfigs
                  ? { currentVersion: { authConfigOid: authConfigs.in } }
                  : undefined!,
                d.search
                  ? {
                      OR: [
                        { name: { contains: d.search, mode: 'insensitive' as const } },
                        { description: { contains: d.search, mode: 'insensitive' as const } },
                        {
                          integrationProvider: {
                            provider: {
                              name: { contains: d.search, mode: 'insensitive' as const }
                            }
                          }
                        }
                      ]
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationInstanceProviderInclude
          })
      )
    );
  }

  async getIntegrationInstanceProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceProviderId: string;
    allowDeleted?: boolean;
  }) {
    let integrationInstanceProvider = await db.integrationInstanceProvider.findFirst({
      where: {
        id: d.integrationInstanceProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: integrationInstanceProviderInclude
    });
    if (!integrationInstanceProvider) {
      throw new ServiceError(
        notFoundError('integration.instance.provider', d.integrationInstanceProviderId)
      );
    }

    return integrationInstanceProvider;
  }

  async setIntegrationInstanceProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: SetIntegrationInstanceProviderInput[];
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedRelation(d.integrationInstance);

    if (d.input.length === 0) return [];

    let providerReferences = d.input.map(input => input.providerId);

    let directIntegrationProviders = await db.integrationProvider.findMany({
      where: {
        id: { in: providerReferences },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    });
    let integrationProvidersByReference = new Map(
      directIntegrationProviders.map(integrationProvider => [
        integrationProvider.id,
        integrationProvider
      ])
    );

    let missingReferences = providerReferences.filter(
      reference => !integrationProvidersByReference.has(reference!)
    );
    let fallbackProviders = await Promise.all(
      missingReferences.map(async reference => ({
        reference: reference!,
        provider: await providerService.getProviderById({
          providerId: reference!,
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment
        })
      }))
    );

    if (fallbackProviders.length) {
      let fallbackIntegrationProviders = await db.integrationProvider.findMany({
        where: {
          integrationOid: d.integrationInstance.integrationOid,
          providerOid: { in: fallbackProviders.map(({ provider }) => provider.oid) },
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          status: 'active'
        }
      });

      for (let { reference, provider } of fallbackProviders) {
        let integrationProvider = fallbackIntegrationProviders.find(
          integrationProvider => integrationProvider.providerOid === provider.oid
        );
        if (integrationProvider) {
          integrationProvidersByReference.set(reference, integrationProvider);
        }
      }
    }

    let integrationProviders = providerReferences.map(reference => {
      let integrationProvider = integrationProvidersByReference.get(reference!);
      if (!integrationProvider) {
        throw new ServiceError(notFoundError('integration.provider', reference));
      }
      return integrationProvider;
    });

    let seenIntegrationProviderOids = new Set<string>();
    for (let integrationProvider of integrationProviders) {
      checkDeletedRelation(integrationProvider);
      if (integrationProvider.integrationOid !== d.integrationInstance.integrationOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Integration provider does not belong to this integration instance.',
            code: 'integration_instance_provider_mismatch'
          })
        );
      }

      let oid = integrationProvider.oid.toString();
      if (seenIntegrationProviderOids.has(oid)) {
        throw new ServiceError(
          badRequestError({
            message: 'Integration instance provider inputs contain duplicates.',
            code: 'duplicate_integration_instance_provider'
          })
        );
      }
      seenIntegrationProviderOids.add(oid);
    }

    let materialProviders = await Promise.all(
      integrationProviders.map(integrationProvider =>
        requireCurrentIntegrationProviderVersion(integrationProvider.oid)
      )
    );

    let combinations = await providerCombinationService.getCombinations({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      providers: d.input.map((input, idx) => ({
        deploymentId: materialProviders[idx]!.currentVersion!.deployment.id,
        configId: input.providerConfigId ?? materialProviders[idx]!.currentVersion!.config?.id,
        authConfigId: input.providerAuthConfigId
      }))
    });

    let toolFilters = d.input.map((input, idx) =>
      'toolFilters' in input
        ? normalizeIntegrationProviderToolFilter(input.toolFilters)
        : (materialProviders[idx]!.currentVersion!.toolFilter as PrismaJson.ToolFilter)
    );

    return await withTransaction(async db => {
      let existingIntegrationInstanceProviders = await db.integrationInstanceProvider.findMany(
        {
          where: {
            integrationInstanceOid: d.integrationInstance.oid,
            integrationProviderOid: {
              in: integrationProviders.map(integrationProvider => integrationProvider.oid)
            }
          }
        }
      );
      let existingByIntegrationProviderOid = new Map(
        existingIntegrationInstanceProviders.map(integrationInstanceProvider => [
          integrationInstanceProvider.integrationProviderOid,
          integrationInstanceProvider
        ])
      );

      let integrationInstanceProviderOids: bigint[] = [];

      for (let [idx, integrationProvider] of integrationProviders.entries()) {
        let materialProvider = materialProviders[idx]!;
        let combination = combinations[idx]!;
        let existing = existingByIntegrationProviderOid.get(integrationProvider.oid);

        let integrationInstanceProvider = existing
          ? await db.integrationInstanceProvider.update({
              where: { oid: existing.oid },
              data: {
                status: 'active',
                archivedAt: null,
                isParentDeleted: false,
                name: materialProvider.name,
                description: materialProvider.description,
                metadata: materialProvider.metadata,
                integrationVersionOid: materialProvider.integration.currentVersion!.oid
              }
            })
          : await db.integrationInstanceProvider.create({
              data: {
                ...getId('integrationInstanceProvider'),
                status: 'active',
                name: materialProvider.name,
                description: materialProvider.description,
                metadata: materialProvider.metadata,
                integrationOid: d.integrationInstance.integrationOid,
                integrationInstanceOid: d.integrationInstance.oid,
                integrationProviderOid: integrationProvider.oid,
                integrationVersionOid: materialProvider.integration.currentVersion!.oid,
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                environmentOid: d.environment.oid
              }
            });

        await createIntegrationInstanceProviderVersion({
          integrationInstanceProviderOid: integrationInstanceProvider.oid,
          status: 'active',
          integrationProviderVersionOid: materialProvider.currentVersion!.oid,
          configOid: combination.config.oid,
          authConfigOid: combination.authConfig?.oid,
          toolFilter: toolFilters[idx]!
        });

        integrationInstanceProviderOids.push(integrationInstanceProvider.oid);
      }

      await refreshIntegrationInstanceStatus({
        integrationInstanceOid: d.integrationInstance.oid
      });

      let res = await db.integrationInstanceProvider.findMany({
        where: { oid: { in: integrationInstanceProviderOids } },
        include: integrationInstanceProviderInclude
      });
      let resByOid = new Map(
        res.map(integrationInstanceProvider => [
          integrationInstanceProvider.oid,
          integrationInstanceProvider
        ])
      );
      let orderedRes = integrationInstanceProviderOids.map(oid => resByOid.get(oid)!);

      await addAfterTransactionHook(async () =>
        integrationInstanceProviderSetQueue.addMany(
          orderedRes.map(integrationInstanceProvider => ({
            integrationInstanceId: d.integrationInstance.id,
            integrationInstanceProviderId: integrationInstanceProvider.id
          }))
        )
      );

      return orderedRes;
    });
  }

  async setIntegrationInstanceProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: SetIntegrationInstanceProviderInput;
  }) {
    let [integrationInstanceProvider] = await this.setIntegrationInstanceProviders({
      ...d,
      input: [d.input]
    });

    if (!integrationInstanceProvider) {
      throw new ServiceError(
        badRequestError({
          message: 'Integration instance provider could not be set.',
          code: 'integration_instance_provider_not_set'
        })
      );
    }

    return integrationInstanceProvider;
  }

  async archiveIntegrationInstanceProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceProvider: IntegrationInstanceProvider;
  }) {
    checkTenant(d, d.integrationInstanceProvider);
    checkDeletedEdit(d.integrationInstanceProvider, 'archive');

    return await withTransaction(async db => {
      let integrationInstanceProvider = await db.integrationInstanceProvider.update({
        where: {
          oid: d.integrationInstanceProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        }
      });

      let current = await db.integrationInstanceProviderVersion.findFirst({
        where: { oid: d.integrationInstanceProvider.currentVersionOid ?? -1n },
        include: integrationInstanceProviderVersionInclude
      });
      if (current) {
        await createIntegrationInstanceProviderVersion({
          integrationInstanceProviderOid: integrationInstanceProvider.oid,
          status: 'archived',
          integrationProviderVersionOid: current.integrationProviderVersionOid,
          configOid: current.configOid,
          authConfigOid: current.authConfigOid,
          toolFilter: current.toolFilter as PrismaJson.ToolFilter
        });
      }

      let res = await db.integrationInstanceProvider.findUniqueOrThrow({
        where: { oid: integrationInstanceProvider.oid },
        include: integrationInstanceProviderInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceProviderSetQueue.add({
          integrationInstanceId: res.integrationInstance.id,
          integrationInstanceProviderId: res.id
        })
      );

      return res;
    });
  }
}

export let integrationInstanceProviderService = Service.create(
  'integrationInstanceProvider',
  () => new integrationInstanceProviderServiceImpl()
).build();
