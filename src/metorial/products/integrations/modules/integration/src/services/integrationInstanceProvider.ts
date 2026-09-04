import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Integration,
  type IntegrationInstance,
  type IntegrationInstanceProvider,
  type IntegrationInstanceProviderStatus,
  type ProviderAuthConfig,
  type ProviderConfig,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
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
  resolveProviders,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { providerService } from '@metorial-subspace/module-catalog';
import {
  assertAuthMethodAllowedForTenant,
  providerCombinationService
} from '@metorial-subspace/module-provider-internal';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  toProviderEventBase,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  createIntegrationInstanceProviderVersion,
  normalizeIntegrationProviderToolFilter,
  refreshIntegrationInstanceStatus
} from '../lib/versions';
import {
  enqueueIntegrationInstanceProviderSet,
  enqueueIntegrationInstanceProvidersSet
} from '../queues/lifecycle/integrationInstanceProvider';
import { getIntegrationToolFilterCapabilities } from './integration';
import {
  integrationInstanceProviderInclude,
  integrationInstanceProviderVersionInclude
} from './integrationInstance';
import { integrationProviderService, MAX_INTEGRATION_PROVIDERS } from './integrationProvider';

let requireCurrentIntegrationProviderVersion = async (d: {
  integrationProviderOid: bigint;
}) => {
  return withTransaction(async db => {
    let integrationProvider = await db.integrationProvider.findUniqueOrThrow({
      where: { oid: d.integrationProviderOid },
      include: {
        integration: { include: { currentVersion: true } },
        provider: { include: { type: true } },
        currentVersion: {
          include: {
            deployment: true,
            config: true,
            authMethod: true
          }
        }
      }
    });

    if (
      !integrationProvider.currentVersion ||
      !integrationProvider.integration.currentVersion
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Integration provider has no active version.',
          code: 'integration_provider_version_required'
        })
      );
    }

    return integrationProvider;
  });
};

let isAllowAllToolFilter = (toolFilter: PrismaJson.ToolFilter | null | undefined) =>
  normalizeIntegrationProviderToolFilter(toolFilter).type === 'v1.allow_all';

let stripToolFilterOverrideFlag = (
  toolFilter: PrismaJson.ToolFilter
): PrismaJson.ToolFilter => {
  if (toolFilter.type === 'v1.allow_all') return { type: 'v1.allow_all' };

  return {
    type: 'v1.filter',
    filters: toolFilter.filters
  };
};

let getInputOverrideToolFilter = (input: SetIntegrationInstanceProviderInput) => {
  if (input.isOverrideToolFilter !== undefined) return input.isOverrideToolFilter;
  if (input.toolFilters === undefined) return undefined;

  return normalizeIntegrationProviderToolFilter(input.toolFilters).ignoreParentFilters;
};

let shouldInheritSharedConfig = (d: {
  input: SetIntegrationInstanceProviderInput;
  sharedConfigId?: string | null;
}) => {
  if (!d.sharedConfigId) return false;
  return d.input.providerConfigId === null || d.input.providerConfigId === d.sharedConfigId;
};

let configOwnershipError = (kind: 'config' | 'auth_config', id: string) =>
  badRequestError({
    message: `Provider ${kind === 'config' ? 'config' : 'auth config'} is already connected to another integration instance provider.`,
    code:
      kind === 'config'
        ? 'provider_config_already_owned'
        : 'provider_auth_config_already_owned',
    data: { id }
  });

let deploymentLockError = (kind: 'config' | 'auth_config', id: string) =>
  badRequestError({
    message: `Provider ${kind === 'config' ? 'config' : 'auth config'} is locked to a different deployment.`,
    code:
      kind === 'config'
        ? 'provider_config_deployment_mismatch'
        : 'provider_auth_config_deployment_mismatch',
    data: { id }
  });

let assertCanUseOwnedResource = (d: {
  kind: 'config' | 'auth_config';
  resource: Pick<
    ProviderConfig | ProviderAuthConfig,
    'id' | 'owningIntegrationInstanceOid' | 'owningIntegrationInstanceProviderOid'
  >;
  integrationInstanceOid: bigint;
  integrationInstanceProviderOid?: bigint;
}) => {
  let hasOwner =
    d.resource.owningIntegrationInstanceOid !== null ||
    d.resource.owningIntegrationInstanceProviderOid !== null;
  if (!hasOwner) return;

  if (
    d.resource.owningIntegrationInstanceOid !== d.integrationInstanceOid ||
    d.resource.owningIntegrationInstanceProviderOid !== d.integrationInstanceProviderOid
  ) {
    throw new ServiceError(configOwnershipError(d.kind, d.resource.id));
  }
};

export type SetIntegrationInstanceProviderInput = {
  providerId: string;
  providerDeploymentId?: string;
  providerConfigId?: string | null;
  providerAuthConfigId?: string;
  toolFilters?: PrismaJson.ToolFilter | null;
  isOverrideToolFilter?: boolean;
  lockProviderResources?: boolean;
};

export type ListIntegrationInstanceProvidersParams = {
  search?: string;
  includeMagicMcpBackings?: boolean;

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
  sessionTemplateIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIntegrationInstanceProviderByIdParams = {
  integrationInstanceProviderId: string;
  allowDeleted?: boolean;
};

export type SetIntegrationInstanceProviderParams = {
  integrationInstance: IntegrationInstance;
  input: SetIntegrationInstanceProviderInput;
  _canBreakIntegrationCanRules?: boolean;
  _allowMissingProviderAuthConfig?: boolean;
  _canBypassProviderResourceOwnershipChecks?: boolean;
};

class integrationInstanceProviderServiceImpl {
  async listIntegrationInstanceProviders(
    d: MetorialFacing<ListIntegrationInstanceProvidersParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listIntegrationInstanceProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listIntegrationInstanceProvidersInternal(
    d: { tenant: Tenant; environment: Environment } & ListIntegrationInstanceProvidersParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let integrations = await resolveIntegrations(ts, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(ts, d.integrationInstanceIds);
    let providers = await resolveProviders(ts, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(ts, d.integrationProviderIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);
    let sessionTemplates = await resolveSessionTemplates(ts, d.sessionTemplateIds);

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationInstanceProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              integrationInstance: d.includeMagicMcpBackings
                ? { isHiddenDraft: false }
                : { isMagicMcpBacking: false, isHiddenDraft: false },

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
                sessionTemplates
                  ? {
                      integrationInstance: {
                        sessionTemplates: {
                          some: { oid: sessionTemplates.in }
                        }
                      }
                    }
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

  async getIntegrationInstanceProviderById(
    d: MetorialFacing<GetIntegrationInstanceProviderByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getIntegrationInstanceProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getIntegrationInstanceProviderByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetIntegrationInstanceProviderByIdParams
  ) {
    let solution = await getMetorialSolution();

    let integrationInstanceProvider = await db.integrationInstanceProvider.findFirst({
      where: {
        id: d.integrationInstanceProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
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

  async setIntegrationInstanceProvidersInternal(d: {
    tenant: Tenant;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: SetIntegrationInstanceProviderInput[];
    _canBreakIntegrationCanRules?: boolean;
    _allowMissingProviderAuthConfig?: boolean;
    _canBypassProviderResourceOwnershipChecks?: boolean;
  }) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integrationInstance);
    checkDeletedRelation(d.integrationInstance);

    if (d.input.length === 0) return [];

    return await withTransaction(async db => {
      let providerReferences = d.input.map(input => input.providerId);

      let directIntegrationProviders = await db.integrationProvider.findMany({
        where: {
          id: { in: providerReferences },
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
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
          provider: await providerService.getProviderByIdInternal({
            providerId: reference!,
            tenant: d.tenant,
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
            solutionOid: solution.oid,
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

      let existingActiveProviderCount = await db.integrationInstanceProvider.count({
        where: {
          integrationInstanceOid: d.integrationInstance.oid,
          status: 'active' as const,
          isParentDeleted: false,
          integrationProviderOid: {
            notIn: integrationProviders.map(integrationProvider => integrationProvider.oid)
          }
        }
      });
      if (
        existingActiveProviderCount + integrationProviders.length >
        MAX_INTEGRATION_PROVIDERS
      ) {
        throw new ServiceError(
          badRequestError({
            message: `Cannot associate more than ${MAX_INTEGRATION_PROVIDERS} providers to an integration instance`
          })
        );
      }

      let materialProviders = await Promise.all(
        integrationProviders.map(integrationProvider =>
          requireCurrentIntegrationProviderVersion({
            integrationProviderOid: integrationProvider.oid
          })
        )
      );

      let existingIntegrationInstanceProviders = await db.integrationInstanceProvider.findMany(
        {
          where: {
            integrationInstanceOid: d.integrationInstance.oid,
            integrationProviderOid: {
              in: integrationProviders.map(integrationProvider => integrationProvider.oid)
            }
          },
          include: {
            currentVersion: {
              include: {
                config: true,
                authConfig: { include: { authMethod: true } },
                integrationProviderVersion: { include: { authMethod: true } }
              }
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

      for (let [idx, input] of d.input.entries()) {
        let materialProvider = materialProviders[idx]!;
        let integration = materialProvider.integration;
        let sharedConfigId = materialProvider.currentVersion!.config?.id;
        let existing = existingByIntegrationProviderOid.get(integrationProviders[idx]!.oid);
        let isOverrideToolFilter =
          getInputOverrideToolFilter(input) ??
          existing?.currentVersion?.isOverrideToolFilter ??
          false;

        if (
          !d._canBreakIntegrationCanRules &&
          !integration.canAttachCustomProviderConfig &&
          materialProvider.provider.type.attributes.config.status !== 'disabled' &&
          input.providerConfigId &&
          sharedConfigId &&
          input.providerConfigId !== sharedConfigId
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'Integration does not allow custom provider configs.',
              code: 'custom_provider_config_not_allowed'
            })
          );
        }

        let capabilities = getIntegrationToolFilterCapabilities(integration);

        if (
          !d._canBreakIntegrationCanRules &&
          isOverrideToolFilter &&
          !capabilities.canOverrideToolFilters
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'Integration does not allow overriding tool filters.',
              code: 'tool_filter_override_not_allowed'
            })
          );
        }

        if (
          !d._canBreakIntegrationCanRules &&
          !capabilities.canAttachCustomToolFilters &&
          input.toolFilters &&
          !isAllowAllToolFilter(input.toolFilters)
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'Integration does not allow custom tool filters.',
              code: 'custom_tool_filters_not_allowed'
            })
          );
        }
      }

      let inheritSharedConfigs = d.input.map((input, idx) =>
        shouldInheritSharedConfig({
          input,
          sharedConfigId: materialProviders[idx]!.currentVersion!.config?.id
        })
      );

      let configIds = d.input.map((input, idx) => {
        let sharedConfigId = materialProviders[idx]!.currentVersion!.config?.id;
        if (inheritSharedConfigs[idx] && sharedConfigId) return sharedConfigId;

        if (input.providerConfigId === undefined) {
          let existingConfigId = existingByIntegrationProviderOid.get(
            integrationProviders[idx]!.oid
          )?.currentVersion?.config?.id;
          if (existingConfigId) return existingConfigId;

          // On create, inherit the integration provider's shared config by default.
          if (sharedConfigId) return sharedConfigId;

          return undefined;
        }

        if (input.providerConfigId === null) return undefined;

        return input.providerConfigId;
      });

      let combinations = await providerCombinationService.getCombinationsInternal({
        tenant: d.tenant,
        environment: d.environment,
        allowMissingAuthConfig: d._allowMissingProviderAuthConfig,
        providers: d.input.map((input, idx) => ({
          deploymentId:
            input.providerDeploymentId ??
            materialProviders[idx]!.currentVersion!.deployment.id,
          configId: configIds[idx],
          authConfigId: input.providerAuthConfigId
        }))
      });

      for (let [idx, combination] of combinations.entries()) {
        let materialProvider = materialProviders[idx]!;
        let existing = existingByIntegrationProviderOid.get(integrationProviders[idx]!.oid);
        let authMethod =
          combination.authConfig?.authMethod ?? materialProvider.currentVersion!.authMethod;
        let existingAuthMethod =
          existing?.currentVersion?.authConfig?.authMethod ??
          existing?.currentVersion?.integrationProviderVersion.authMethod;

        if (!existing || authMethod?.oid !== existingAuthMethod?.oid) {
          assertAuthMethodAllowedForTenant({
            tenant: d.tenant,
            authMethod,
            requiresAuth: materialProvider.provider.type.supportsAuth
          });
        }
      }

      let toolFilters = d.input.map((input, idx) => {
        let existing = existingByIntegrationProviderOid.get(integrationProviders[idx]!.oid);
        let isOverrideToolFilter =
          getInputOverrideToolFilter(input) ??
          existing?.currentVersion?.isOverrideToolFilter ??
          false;

        let toolFilter: PrismaJson.ToolFilter | null;
        if (input.toolFilters === undefined) {
          toolFilter = existing?.currentVersion?.toolFilter
            ? stripToolFilterOverrideFlag(
                normalizeIntegrationProviderToolFilter(
                  existing.currentVersion.toolFilter as PrismaJson.ToolFilter
                )
              )
            : null;
        } else {
          toolFilter = stripToolFilterOverrideFlag(
            normalizeIntegrationProviderToolFilter(input.toolFilters)
          );
        }

        if (!isOverrideToolFilter && (!toolFilter || isAllowAllToolFilter(toolFilter))) {
          return null;
        }

        return toolFilter ?? normalizeIntegrationProviderToolFilter(null);
      });
      let isOverrideToolFilters = d.input.map((input, idx) => {
        let existing = existingByIntegrationProviderOid.get(integrationProviders[idx]!.oid);
        return (
          getInputOverrideToolFilter(input) ??
          existing?.currentVersion?.isOverrideToolFilter ??
          false
        );
      });

      let integrationInstanceProviderOids: bigint[] = [];

      for (let [idx, integrationProvider] of integrationProviders.entries()) {
        let materialProvider = materialProviders[idx]!;
        let combination = combinations[idx]!;
        let existing = existingByIntegrationProviderOid.get(integrationProvider.oid);
        let deploymentOid = materialProvider.currentVersion!.deploymentOid;
        let isInheritedSharedConfig =
          materialProvider.currentVersion!.config?.oid === combination.config.oid;

        if (!isInheritedSharedConfig) {
          if (!d._canBypassProviderResourceOwnershipChecks) {
            assertCanUseOwnedResource({
              kind: 'config',
              resource: combination.config,
              integrationInstanceOid: d.integrationInstance.oid,
              integrationInstanceProviderOid: existing?.oid
            });
          }
        }
        if (
          combination.config.deploymentOid &&
          combination.config.deploymentOid !== deploymentOid
        ) {
          throw new ServiceError(deploymentLockError('config', combination.config.id));
        }

        if (combination.authConfig) {
          if (!d._canBypassProviderResourceOwnershipChecks) {
            assertCanUseOwnedResource({
              kind: 'auth_config',
              resource: combination.authConfig,
              integrationInstanceOid: d.integrationInstance.oid,
              integrationInstanceProviderOid: existing?.oid
            });
          }
          if (
            combination.authConfig.deploymentOid &&
            combination.authConfig.deploymentOid !== deploymentOid
          ) {
            throw new ServiceError(
              deploymentLockError('auth_config', combination.authConfig.id)
            );
          }
        }

        let integrationInstanceProvider = await db.integrationInstanceProvider.upsert({
          where: {
            integrationInstanceOid_integrationProviderOid: {
              integrationInstanceOid: d.integrationInstance.oid,
              integrationProviderOid: integrationProvider.oid
            }
          },
          create: {
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
            projectOid: d.tenant.projectOid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid
          },
          update: {
            status: 'active',
            archivedAt: null,
            isParentDeleted: false,
            name: materialProvider.name,
            description: materialProvider.description,
            metadata: materialProvider.metadata,
            integrationVersionOid: materialProvider.integration.currentVersion!.oid
          }
        });

        if (!isInheritedSharedConfig && d.input[idx]!.lockProviderResources) {
          let configUpdate = await db.providerConfig.updateMany({
            where: {
              oid: combination.config.oid,
              AND: [
                {
                  OR: [
                    {
                      owningIntegrationInstanceOid: null,
                      owningIntegrationInstanceProviderOid: null
                    },
                    {
                      owningIntegrationInstanceOid: d.integrationInstance.oid,
                      owningIntegrationInstanceProviderOid: integrationInstanceProvider.oid
                    }
                  ]
                },
                {
                  OR: [{ deploymentOid: null }, { deploymentOid: deploymentOid }]
                }
              ]
            },
            data: {
              owningIntegrationInstanceOid: d.integrationInstance.oid,
              owningIntegrationInstanceProviderOid: integrationInstanceProvider.oid,
              deploymentOid
            }
          });
          if (configUpdate.count !== 1) {
            throw new ServiceError(configOwnershipError('config', combination.config.id));
          }
        }

        if (combination.authConfig && d.input[idx]!.lockProviderResources) {
          let authConfigUpdate = await db.providerAuthConfig.updateMany({
            where: {
              oid: combination.authConfig.oid,
              AND: [
                {
                  OR: [
                    {
                      owningIntegrationInstanceOid: null,
                      owningIntegrationInstanceProviderOid: null
                    },
                    {
                      owningIntegrationInstanceOid: d.integrationInstance.oid,
                      owningIntegrationInstanceProviderOid: integrationInstanceProvider.oid
                    }
                  ]
                },
                {
                  OR: [{ deploymentOid: null }, { deploymentOid: deploymentOid }]
                }
              ]
            },
            data: {
              owningIntegrationInstanceOid: d.integrationInstance.oid,
              owningIntegrationInstanceProviderOid: integrationInstanceProvider.oid,
              deploymentOid
            }
          });
          if (authConfigUpdate.count !== 1) {
            throw new ServiceError(
              configOwnershipError('auth_config', combination.authConfig.id)
            );
          }
        }

        await createIntegrationInstanceProviderVersion({
          integrationInstanceProviderOid: integrationInstanceProvider.oid,
          status: 'active',
          integrationProviderVersionOid: materialProvider.currentVersion!.oid,
          configOid: combination.config.oid,
          authConfigOid: combination.authConfig?.oid,
          toolFilter: toolFilters[idx],
          isOverrideToolFilter: isOverrideToolFilters[idx]
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
        enqueueIntegrationInstanceProvidersSet(
          orderedRes.map(integrationInstanceProvider => ({
            integrationInstanceId: d.integrationInstance.id,
            integrationInstanceProviderId: integrationInstanceProvider.id
          }))
        )
      );

      return orderedRes;
    });
  }

  async setIntegrationInstanceProvider(
    d: MetorialFacing<SetIntegrationInstanceProviderParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.integration_instance_provider.set:before', eventBase);

    let integrationInstanceProvider = await this.setIntegrationInstanceProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.integration_instance_provider.set:after', {
      ...eventBase,
      integrationInstanceProvider
    });

    return integrationInstanceProvider;
  }

  async setIntegrationInstanceProviderInternal(
    d: { tenant: Tenant; environment: Environment } & SetIntegrationInstanceProviderParams
  ) {
    let [integrationInstanceProvider] = await this.setIntegrationInstanceProvidersInternal({
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

  async repinIntegrationInstanceProvidersToIntegrationProviderVersion(d: {
    integrationProviderVersionOid: bigint | null;
    integrationInstanceProviders: {
      oid: bigint;
      currentVersion?: {
        integrationProviderVersionOid: bigint;
        configOid?: bigint | null;
        authConfigOid?: bigint | null;
        toolFilter?: PrismaJson.ToolFilter | null;
        isOverrideToolFilter?: boolean | null;
      } | null;
    }[];
  }) {
    if (!d.integrationProviderVersionOid) return;

    for (let integrationInstanceProvider of d.integrationInstanceProviders) {
      let currentVersion = integrationInstanceProvider.currentVersion;
      if (!currentVersion) continue;
      if (currentVersion.integrationProviderVersionOid === d.integrationProviderVersionOid) {
        continue;
      }

      await createIntegrationInstanceProviderVersion({
        integrationInstanceProviderOid: integrationInstanceProvider.oid,
        status: 'active',
        integrationProviderVersionOid: d.integrationProviderVersionOid,
        configOid: currentVersion.configOid,
        authConfigOid: currentVersion.authConfigOid,
        toolFilter: currentVersion.toolFilter,
        isOverrideToolFilter: currentVersion.isOverrideToolFilter ?? false
      });
    }
  }

  async setMagicMcpIntegrationInstanceProvidersInternal(d: {
    tenant: Tenant;
    environment: Environment;
    integration: Integration;
    integrationInstance: IntegrationInstance;
    isReconciliation?: boolean;
    input: {
      providerDeploymentId: string;
      providerConfigId?: string | null;
      providerAuthConfigId?: string | null;
      toolFilters?: PrismaJson.ToolFilter | null;
    }[];
  }) {
    if (!d.input.length) return [];
    if (d.input.length > MAX_INTEGRATION_PROVIDERS) {
      throw new ServiceError(
        badRequestError({
          message: `Cannot associate more than ${MAX_INTEGRATION_PROVIDERS} providers to an integration instance`
        })
      );
    }

    let integrationProviders = [];
    for (let input of d.input) {
      integrationProviders.push(
        await integrationProviderService.ensureIntegrationProviderForDeploymentInternal({
          tenant: d.tenant,
          environment: d.environment,
          integration: d.integration,
          input: {
            providerDeploymentId: input.providerDeploymentId,
            toolFilters: input.toolFilters
          }
        })
      );
    }

    return await this.setIntegrationInstanceProvidersInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationInstance: d.integrationInstance,
      // Magic MCP backing reconciliation must preserve explicit provider config/filter choices
      // even when the linked integration would normally reject them.
      _canBreakIntegrationCanRules: true,
      _allowMissingProviderAuthConfig: d.isReconciliation,
      _canBypassProviderResourceOwnershipChecks: d.isReconciliation,
      input: d.input.map((input, idx) => ({
        providerId: integrationProviders[idx]!.id,
        providerDeploymentId: input.providerDeploymentId,
        providerConfigId: input.providerConfigId ?? null,
        providerAuthConfigId: input.providerAuthConfigId ?? undefined,
        toolFilters: input.toolFilters
      }))
    });
  }

  async archiveIntegrationInstanceProviderInternal(d: {
    tenant: Tenant;
    environment: Environment;
    integrationInstanceProvider: IntegrationInstanceProvider;
  }) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integrationInstanceProvider);
    checkDeletedEdit(d.integrationInstanceProvider, 'archive');

    return await withTransaction(async db => {
      let integrationInstanceProvider = await db.integrationInstanceProvider.update({
        where: {
          oid: d.integrationInstanceProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
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
          toolFilter: current.toolFilter as PrismaJson.ToolFilter | null,
          isOverrideToolFilter: current.isOverrideToolFilter
        });
      }

      let res = await db.integrationInstanceProvider.findUniqueOrThrow({
        where: { oid: integrationInstanceProvider.oid },
        include: integrationInstanceProviderInclude
      });

      await addAfterTransactionHook(async () =>
        enqueueIntegrationInstanceProviderSet({
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
