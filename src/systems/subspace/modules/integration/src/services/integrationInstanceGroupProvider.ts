import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type IntegrationInstanceGroup,
  type IntegrationInstanceGroupProvider,
  type IntegrationInstanceGroupProviderStatus,
  Prisma,
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
import { normalizeToolFilters } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  enqueueIntegrationInstanceGroupProviderSet,
  enqueueIntegrationInstanceGroupProvidersSet
} from '../queues/lifecycle/integrationInstanceGroupProvider';
import { integrationInstanceGroupProviderInclude } from './integrationInstanceGroup';

export type SetIntegrationInstanceGroupProviderInput = {
  integrationInstanceProviderId: string;
  toolFilters?: PrismaJson.ToolFilter | null;
};

let stripToolFilterOverrideFlag = (
  toolFilter: PrismaJson.ToolFilter
): PrismaJson.ToolFilter => {
  if (toolFilter.type === 'v1.allow_all') return { type: 'v1.allow_all' };

  return {
    type: 'v1.filter',
    filters: toolFilter.filters
  };
};

class integrationInstanceGroupProviderServiceImpl {
  async listIntegrationInstanceGroupProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    includeMagicMcpBackings?: boolean;

    status?: IntegrationInstanceGroupProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    integrationInstanceGroupIds?: string[];
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
          await db.integrationInstanceGroupProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              integrationInstanceGroup: d.includeMagicMcpBackings
                ? undefined
                : { isMagicMcpBacking: false },

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.integrationInstanceGroupIds
                  ? {
                      integrationInstanceGroup: {
                        id: { in: d.integrationInstanceGroupIds }
                      }
                    }
                  : undefined!,
                integrations ? { integrationOid: integrations.in } : undefined!,
                integrationInstances
                  ? { integrationInstanceOid: integrationInstances.in }
                  : undefined!,
                integrationInstanceProviders
                  ? { integrationInstanceProviderOid: integrationInstanceProviders.in }
                  : undefined!,
                providers
                  ? { integrationProvider: { providerOid: providers.in } }
                  : undefined!,
                integrationProviders
                  ? { integrationProviderOid: integrationProviders.in }
                  : undefined!,
                deployments
                  ? {
                      integrationInstanceProvider: {
                        currentVersion: {
                          integrationProviderVersion: { deploymentOid: deployments.in }
                        }
                      }
                    }
                  : undefined!,
                configs
                  ? {
                      integrationInstanceProvider: {
                        currentVersion: { configOid: configs.in }
                      }
                    }
                  : undefined!,
                authConfigs
                  ? {
                      integrationInstanceProvider: {
                        currentVersion: { authConfigOid: authConfigs.in }
                      }
                    }
                  : undefined!,
                sessionTemplates
                  ? {
                      sessionTemplateProviders: {
                        some: { sessionTemplateOid: sessionTemplates.in }
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationInstanceGroupProviderInclude
          })
      )
    );
  }

  async getIntegrationInstanceGroupProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroupProviderId: string;
    allowDeleted?: boolean;
  }) {
    let provider = await db.integrationInstanceGroupProvider.findFirst({
      where: {
        id: d.integrationInstanceGroupProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: integrationInstanceGroupProviderInclude
    });
    if (!provider) {
      throw new ServiceError(
        notFoundError(
          'integration.instance.group.provider',
          d.integrationInstanceGroupProviderId
        )
      );
    }

    return provider;
  }

  async setIntegrationInstanceGroupProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup;
    input: SetIntegrationInstanceGroupProviderInput[];
    _allowMagicMcpBacking?: boolean;
    _skipLifecycleSync?: boolean;
  }) {
    checkTenant(d, d.integrationInstanceGroup);
    checkDeletedRelation(d.integrationInstanceGroup);
    if (d.integrationInstanceGroup.isMagicMcpBacking && !d._allowMagicMcpBacking) {
      throw new ServiceError(
        badRequestError({
          message:
            'Magic MCP backed integration instance group providers cannot be updated directly.',
          code: 'magic_mcp_backing_integration_group_provider_update_blocked'
        })
      );
    }

    if (d.input.length === 0) return [];

    let sourceProviders = await db.integrationInstanceProvider.findMany({
      where: {
        id: { in: d.input.map(input => input.integrationInstanceProviderId) },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: 'active',
        isParentDeleted: false
      },
      include: {
        integration: true,
        integrationInstance: true,
        integrationProvider: true,
        currentVersion: {
          include: {
            integrationProviderVersion: true,
            config: true,
            authConfig: true
          }
        }
      }
    });
    let sourceProvidersById = new Map(
      sourceProviders.map(provider => [provider.id, provider])
    );

    let orderedSourceProviders = d.input.map(input => {
      let sourceProvider = sourceProvidersById.get(input.integrationInstanceProviderId);
      if (!sourceProvider) {
        throw new ServiceError(
          notFoundError('integration.instance.provider', input.integrationInstanceProviderId)
        );
      }
      if (!sourceProvider.currentVersion?.configOid) {
        throw new ServiceError(
          badRequestError({
            message:
              'Integration instance provider does not have a configured provider config.',
            code: 'integration_instance_provider_config_required'
          })
        );
      }

      return sourceProvider;
    });

    let seenIntegrationProviderOids = new Set<string>();
    let seenIntegrationInstanceProviderOids = new Set<string>();
    for (let sourceProvider of orderedSourceProviders) {
      let integrationProviderOid = sourceProvider.integrationProviderOid.toString();
      if (seenIntegrationProviderOids.has(integrationProviderOid)) {
        throw new ServiceError(
          badRequestError({
            message:
              'Integration instance group provider inputs contain duplicate integration providers.',
            code: 'duplicate_integration_instance_group_provider'
          })
        );
      }
      seenIntegrationProviderOids.add(integrationProviderOid);

      let sourceProviderOid = sourceProvider.oid.toString();
      if (seenIntegrationInstanceProviderOids.has(sourceProviderOid)) {
        throw new ServiceError(
          badRequestError({
            message:
              'Integration instance group provider inputs contain duplicate source providers.',
            code: 'duplicate_integration_instance_group_source_provider'
          })
        );
      }
      seenIntegrationInstanceProviderOids.add(sourceProviderOid);
    }

    let existingSources = await db.integrationInstanceGroupSource.findMany({
      where: {
        integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
        integrationInstanceOid: {
          in: orderedSourceProviders.map(provider => provider.integrationInstanceOid)
        }
      }
    });
    let existingSourcesByIntegrationInstanceOid = new Map(
      existingSources.map(source => [source.integrationInstanceOid, source])
    );

    let existingGroupProviders = await db.integrationInstanceGroupProvider.findMany({
      where: {
        integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
        integrationInstanceProviderOid: {
          in: orderedSourceProviders.map(provider => provider.oid)
        }
      }
    });
    let existingBySourceProviderOid = new Map(
      existingGroupProviders.map(provider => [
        provider.integrationInstanceProviderOid,
        provider
      ])
    );

    return await withTransaction(async db => {
      let providerOids: bigint[] = [];

      for (let [idx, sourceProvider] of orderedSourceProviders.entries()) {
        let source = await db.integrationInstanceGroupSource.upsert({
          where: {
            integrationInstanceGroupOid_integrationInstanceOid: {
              integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
              integrationInstanceOid: sourceProvider.integrationInstanceOid
            }
          },
          create: {
            ...getId('integrationInstanceGroupSource'),
            status: 'active',
            integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
            integrationInstanceOid: sourceProvider.integrationInstanceOid,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid
          },
          update: {
            status: 'active',
            archivedAt: null,
            isParentDeleted: false
          }
        });
        existingSourcesByIntegrationInstanceOid.set(
          sourceProvider.integrationInstanceOid,
          source
        );

        let input = d.input[idx]!;
        let existing = existingBySourceProviderOid.get(sourceProvider.oid);
        let inputToolFilter =
          input.toolFilters === undefined
            ? undefined
            : normalizeToolFilters(input.toolFilters);
        let isOverrideToolFilter =
          inputToolFilter?.ignoreParentFilters ?? existing?.isOverrideToolFilter ?? false;
        let toolFilter =
          input.toolFilters === undefined
            ? existing?.toolFilter
              ? stripToolFilterOverrideFlag(
                  normalizeToolFilters(existing.toolFilter as PrismaJson.ToolFilter)
                )
              : null
            : stripToolFilterOverrideFlag(inputToolFilter!);

        let groupProvider = await db.integrationInstanceGroupProvider.upsert({
          where: {
            integrationInstanceGroupOid_integrationInstanceProviderOid: {
              integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
              integrationInstanceProviderOid: sourceProvider.oid
            }
          },
          create: {
            ...getId('integrationInstanceGroupProvider'),
            status: 'active',
            name: sourceProvider.name,
            description: sourceProvider.description,
            metadata: sourceProvider.metadata,
            privateMetadata: sourceProvider.privateMetadata,
            integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
            integrationInstanceGroupSourceOid: source.oid,
            integrationOid: sourceProvider.integrationOid,
            integrationInstanceOid: sourceProvider.integrationInstanceOid,
            integrationInstanceProviderOid: sourceProvider.oid,
            integrationProviderOid: sourceProvider.integrationProviderOid,
            toolFilter: toolFilter ?? Prisma.JsonNull,
            isOverrideToolFilter,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid
          },
          update: {
            status: 'active',
            archivedAt: null,
            isParentDeleted: false,
            name: sourceProvider.name,
            description: sourceProvider.description,
            metadata: sourceProvider.metadata,
            privateMetadata: sourceProvider.privateMetadata,
            integrationInstanceGroupSourceOid: source.oid,
            integrationOid: sourceProvider.integrationOid,
            integrationInstanceOid: sourceProvider.integrationInstanceOid,
            integrationProviderOid: sourceProvider.integrationProviderOid,
            toolFilter: toolFilter ?? Prisma.JsonNull,
            isOverrideToolFilter
          }
        });

        providerOids.push(groupProvider.oid);
      }

      await db.integrationInstanceGroup.update({
        where: { oid: d.integrationInstanceGroup.oid },
        data: { status: 'active' }
      });

      let providers = await db.integrationInstanceGroupProvider.findMany({
        where: { oid: { in: providerOids } },
        include: integrationInstanceGroupProviderInclude
      });
      let providersByOid = new Map(providers.map(provider => [provider.oid, provider]));
      let orderedProviders = providerOids.map(oid => providersByOid.get(oid)!);

      if (!d._skipLifecycleSync) {
        await addAfterTransactionHook(async () =>
          enqueueIntegrationInstanceGroupProvidersSet(
            orderedProviders.map(provider => ({
              integrationInstanceGroupId: d.integrationInstanceGroup.id,
              integrationInstanceGroupProviderId: provider.id
            }))
          )
        );
      }

      return orderedProviders;
    });
  }

  async setIntegrationInstanceGroupProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup;
    input: SetIntegrationInstanceGroupProviderInput;
  }) {
    let [provider] = await this.setIntegrationInstanceGroupProviders({
      ...d,
      input: [d.input]
    });

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message: 'Integration instance group provider could not be set.',
          code: 'integration_instance_group_provider_not_set'
        })
      );
    }

    return provider;
  }

  async syncMagicMcpIntegrationInstanceGroupProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroup: IntegrationInstanceGroup;
    isReconciliation?: boolean;
    input: SetIntegrationInstanceGroupProviderInput[];
  }) {
    let providers = await this.setIntegrationInstanceGroupProviders({
      ...d,
      _allowMagicMcpBacking: true,
      _skipLifecycleSync: true
    });

    await withTransaction(async db => {
      await db.integrationInstanceGroupProvider.updateMany({
        where: {
          integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
          integrationInstanceProviderOid: {
            notIn: providers.map(provider => provider.integrationInstanceProviderOid)
          },
          status: 'active'
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        }
      });

      await db.integrationInstanceGroup.update({
        where: { oid: d.integrationInstanceGroup.oid },
        data: { status: d.input.length ? 'active' : 'draft' }
      });
    });

    return providers;
  }

  async archiveIntegrationInstanceGroupProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceGroupProvider: IntegrationInstanceGroupProvider;
  }) {
    checkTenant(d, d.integrationInstanceGroupProvider);
    checkDeletedEdit(d.integrationInstanceGroupProvider, 'archive');
    let integrationInstanceGroup = await db.integrationInstanceGroup.findUnique({
      where: { oid: d.integrationInstanceGroupProvider.integrationInstanceGroupOid },
      select: { isMagicMcpBacking: true }
    });
    if (integrationInstanceGroup?.isMagicMcpBacking) {
      throw new ServiceError(
        badRequestError({
          message:
            'Magic MCP backed integration instance group providers cannot be deleted directly.',
          code: 'magic_mcp_backing_integration_group_provider_delete_blocked'
        })
      );
    }

    return await withTransaction(async db => {
      let provider = await db.integrationInstanceGroupProvider.update({
        where: {
          oid: d.integrationInstanceGroupProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include: integrationInstanceGroupProviderInclude
      });

      await addAfterTransactionHook(async () =>
        enqueueIntegrationInstanceGroupProviderSet({
          integrationInstanceGroupId: provider.integrationInstanceGroup.id,
          integrationInstanceGroupProviderId: provider.id
        })
      );

      return provider;
    });
  }
}

export let integrationInstanceGroupProviderService = Service.create(
  'integrationInstanceGroupProvider',
  () => new integrationInstanceGroupProviderServiceImpl()
).build();
