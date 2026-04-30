import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type DelegatedIntegrationInstance,
  type DelegatedIntegrationInstanceProvider,
  type DelegatedIntegrationInstanceProviderStatus,
  type Environment,
  getId,
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
import { delegatedIntegrationInstanceProviderSetQueue } from '../queues/lifecycle/delegatedIntegrationInstanceProvider';
import { delegatedIntegrationInstanceProviderInclude } from './delegatedIntegrationInstance';

export type SetDelegatedIntegrationInstanceProviderInput = {
  integrationInstanceProviderId: string;
  toolFilters?: PrismaJson.ToolFilter | null;
};

class delegatedIntegrationInstanceProviderServiceImpl {
  async listDelegatedIntegrationInstanceProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: DelegatedIntegrationInstanceProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    delegatedIntegrationInstanceIds?: string[];
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
          await db.delegatedIntegrationInstanceProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.delegatedIntegrationInstanceIds
                  ? {
                      delegatedIntegrationInstance: {
                        id: { in: d.delegatedIntegrationInstanceIds }
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
            include: delegatedIntegrationInstanceProviderInclude
          })
      )
    );
  }

  async getDelegatedIntegrationInstanceProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstanceProviderId: string;
    allowDeleted?: boolean;
  }) {
    let provider = await db.delegatedIntegrationInstanceProvider.findFirst({
      where: {
        id: d.delegatedIntegrationInstanceProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: delegatedIntegrationInstanceProviderInclude
    });
    if (!provider) {
      throw new ServiceError(
        notFoundError(
          'delegated.integration.instance.provider',
          d.delegatedIntegrationInstanceProviderId
        )
      );
    }

    return provider;
  }

  async setDelegatedIntegrationInstanceProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstance: DelegatedIntegrationInstance;
    input: SetDelegatedIntegrationInstanceProviderInput[];
  }) {
    checkTenant(d, d.delegatedIntegrationInstance);
    checkDeletedRelation(d.delegatedIntegrationInstance);

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
              'Delegated integration instance provider inputs contain duplicate integration providers.',
            code: 'duplicate_delegated_integration_instance_provider'
          })
        );
      }
      seenIntegrationProviderOids.add(integrationProviderOid);

      let sourceProviderOid = sourceProvider.oid.toString();
      if (seenIntegrationInstanceProviderOids.has(sourceProviderOid)) {
        throw new ServiceError(
          badRequestError({
            message:
              'Delegated integration instance provider inputs contain duplicate source providers.',
            code: 'duplicate_delegated_integration_instance_source_provider'
          })
        );
      }
      seenIntegrationInstanceProviderOids.add(sourceProviderOid);
    }

    let existingSources = await db.delegatedIntegrationInstanceSource.findMany({
      where: {
        delegatedIntegrationInstanceOid: d.delegatedIntegrationInstance.oid,
        integrationInstanceOid: {
          in: orderedSourceProviders.map(provider => provider.integrationInstanceOid)
        }
      }
    });
    let existingSourcesByIntegrationInstanceOid = new Map(
      existingSources.map(source => [source.integrationInstanceOid, source])
    );

    let existingDelegatedProviders = await db.delegatedIntegrationInstanceProvider.findMany({
      where: {
        delegatedIntegrationInstanceOid: d.delegatedIntegrationInstance.oid,
        integrationInstanceProviderOid: {
          in: orderedSourceProviders.map(provider => provider.oid)
        }
      }
    });
    let existingBySourceProviderOid = new Map(
      existingDelegatedProviders.map(provider => [
        provider.integrationInstanceProviderOid,
        provider
      ])
    );

    return await withTransaction(async db => {
      let providerOids: bigint[] = [];

      for (let [idx, sourceProvider] of orderedSourceProviders.entries()) {
        let existingSource = existingSourcesByIntegrationInstanceOid.get(
          sourceProvider.integrationInstanceOid
        );
        let source = existingSource
          ? await db.delegatedIntegrationInstanceSource.update({
              where: { oid: existingSource.oid },
              data: {
                status: 'active',
                archivedAt: null,
                isParentDeleted: false
              }
            })
          : await db.delegatedIntegrationInstanceSource.create({
              data: {
                ...getId('delegatedIntegrationInstanceSource'),
                status: 'active',
                delegatedIntegrationInstanceOid: d.delegatedIntegrationInstance.oid,
                integrationInstanceOid: sourceProvider.integrationInstanceOid,
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                environmentOid: d.environment.oid
              }
            });
        existingSourcesByIntegrationInstanceOid.set(
          sourceProvider.integrationInstanceOid,
          source
        );

        let input = d.input[idx]!;
        let toolFilter =
          input.toolFilters === undefined
            ? ((existingBySourceProviderOid.get(sourceProvider.oid)?.toolFilter as
                | PrismaJson.ToolFilter
                | null
                | undefined) ?? null)
            : normalizeToolFilters(input.toolFilters);

        let existing = existingBySourceProviderOid.get(sourceProvider.oid);
        let delegatedProvider = existing
          ? await db.delegatedIntegrationInstanceProvider.update({
              where: { oid: existing.oid },
              data: {
                status: 'active',
                archivedAt: null,
                isParentDeleted: false,
                name: sourceProvider.name,
                description: sourceProvider.description,
                metadata: sourceProvider.metadata,
                privateMetadata: sourceProvider.privateMetadata,
                delegatedIntegrationInstanceSourceOid: source.oid,
                integrationOid: sourceProvider.integrationOid,
                integrationInstanceOid: sourceProvider.integrationInstanceOid,
                integrationProviderOid: sourceProvider.integrationProviderOid,
                toolFilter: toolFilter ?? Prisma.JsonNull
              }
            })
          : await db.delegatedIntegrationInstanceProvider.create({
              data: {
                ...getId('delegatedIntegrationInstanceProvider'),
                status: 'active',
                name: sourceProvider.name,
                description: sourceProvider.description,
                metadata: sourceProvider.metadata,
                privateMetadata: sourceProvider.privateMetadata,
                delegatedIntegrationInstanceOid: d.delegatedIntegrationInstance.oid,
                delegatedIntegrationInstanceSourceOid: source.oid,
                integrationOid: sourceProvider.integrationOid,
                integrationInstanceOid: sourceProvider.integrationInstanceOid,
                integrationInstanceProviderOid: sourceProvider.oid,
                integrationProviderOid: sourceProvider.integrationProviderOid,
                toolFilter: toolFilter ?? Prisma.JsonNull,
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                environmentOid: d.environment.oid
              }
            });

        providerOids.push(delegatedProvider.oid);
      }

      await db.delegatedIntegrationInstance.update({
        where: { oid: d.delegatedIntegrationInstance.oid },
        data: { status: 'active' }
      });

      let providers = await db.delegatedIntegrationInstanceProvider.findMany({
        where: { oid: { in: providerOids } },
        include: delegatedIntegrationInstanceProviderInclude
      });
      let providersByOid = new Map(providers.map(provider => [provider.oid, provider]));
      let orderedProviders = providerOids.map(oid => providersByOid.get(oid)!);

      await addAfterTransactionHook(async () =>
        delegatedIntegrationInstanceProviderSetQueue.addMany(
          orderedProviders.map(provider => ({
            delegatedIntegrationInstanceId: d.delegatedIntegrationInstance.id,
            delegatedIntegrationInstanceProviderId: provider.id
          }))
        )
      );

      return orderedProviders;
    });
  }

  async setDelegatedIntegrationInstanceProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstance: DelegatedIntegrationInstance;
    input: SetDelegatedIntegrationInstanceProviderInput;
  }) {
    let [provider] = await this.setDelegatedIntegrationInstanceProviders({
      ...d,
      input: [d.input]
    });

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message: 'Delegated integration instance provider could not be set.',
          code: 'delegated_integration_instance_provider_not_set'
        })
      );
    }

    return provider;
  }

  async archiveDelegatedIntegrationInstanceProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegatedIntegrationInstanceProvider: DelegatedIntegrationInstanceProvider;
  }) {
    checkTenant(d, d.delegatedIntegrationInstanceProvider);
    checkDeletedEdit(d.delegatedIntegrationInstanceProvider, 'archive');

    return await withTransaction(async db => {
      let provider = await db.delegatedIntegrationInstanceProvider.update({
        where: {
          oid: d.delegatedIntegrationInstanceProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include: delegatedIntegrationInstanceProviderInclude
      });

      await addAfterTransactionHook(async () =>
        delegatedIntegrationInstanceProviderSetQueue.add({
          delegatedIntegrationInstanceId: provider.delegatedIntegrationInstance.id,
          delegatedIntegrationInstanceProviderId: provider.id
        })
      );

      return provider;
    });
  }
}

export let delegatedIntegrationInstanceProviderService = Service.create(
  'delegatedIntegrationInstanceProvider',
  () => new delegatedIntegrationInstanceProviderServiceImpl()
).build();
