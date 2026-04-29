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

  async setIntegrationInstanceProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: {
      integrationProviderId?: string;
      providerId?: string;
      providerConfigId?: string;
      providerAuthConfigId?: string;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedRelation(d.integrationInstance);

    let providerReference = d.input.integrationProviderId ?? d.input.providerId;
    if (!providerReference) {
      throw new ServiceError(
        badRequestError({
          message: 'Please provide an integration provider or provider.',
          code: 'integration_instance_provider_target_required'
        })
      );
    }

    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        id: providerReference,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    });

    if (!integrationProvider) {
      let provider = await providerService.getProviderById({
        providerId: providerReference,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment
      });

      integrationProvider = await db.integrationProvider.findFirst({
        where: {
          integrationOid: d.integrationInstance.integrationOid,
          providerOid: provider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          status: 'active'
        }
      });
    }

    if (!integrationProvider) {
      throw new ServiceError(notFoundError('integration.provider', providerReference));
    }

    checkDeletedRelation(integrationProvider);
    if (integrationProvider.integrationOid !== d.integrationInstance.integrationOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Integration provider does not belong to this integration instance.',
          code: 'integration_instance_provider_mismatch'
        })
      );
    }

    let materialProvider = await requireCurrentIntegrationProviderVersion(
      integrationProvider.oid
    );

    let [combination] = await providerCombinationService.getCombinations({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      providers: [
        {
          deploymentId: materialProvider.currentVersion!.deployment.id,
          configId: d.input.providerConfigId ?? materialProvider.currentVersion!.config?.id,
          authConfigId: d.input.providerAuthConfigId
        }
      ]
    });

    let toolFilter =
      'toolFilters' in d.input
        ? normalizeIntegrationProviderToolFilter(d.input.toolFilters)
        : (materialProvider.currentVersion!.toolFilter as PrismaJson.ToolFilter);

    return await withTransaction(async db => {
      let existing = await db.integrationInstanceProvider.findUnique({
        where: {
          integrationInstanceOid_integrationProviderOid: {
            integrationInstanceOid: d.integrationInstance.oid,
            integrationProviderOid: integrationProvider.oid
          }
        }
      });

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
        toolFilter
      });

      await refreshIntegrationInstanceStatus({
        integrationInstanceOid: d.integrationInstance.oid
      });

      let res = await db.integrationInstanceProvider.findUniqueOrThrow({
        where: { oid: integrationInstanceProvider.oid },
        include: integrationInstanceProviderInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceProviderSetQueue.add({
          integrationInstanceId: d.integrationInstance.id,
          integrationInstanceProviderId: res.id
        })
      );

      return res;
    });
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
