import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type MagicMcpServerProvider,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import { providerCombinationService } from '@metorial-subspace/module-provider-internal';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { integrationProviderVersionPresentableInclude } from '../../lib/integrationIncludes';
import { integrationInstanceProviderVersionPresentableInclude } from '../integrationInstance';
import { integrationInstanceProviderService } from '../integrationInstanceProvider';
import { integrationProviderService } from '../integrationProvider';
import { getMagicMcpOwnerIntegration, resolveMagicMcpBackingPolicy } from './shared';

export let magicMcpServerProviderInclude = {
  magicMcpServerBacking: true,
  integrationProvider: {
    include: {
      provider: true,
      currentVersion: { include: integrationProviderVersionPresentableInclude }
    }
  },
  integrationInstanceProvider: {
    include: {
      currentVersion: { include: integrationInstanceProviderVersionPresentableInclude }
    }
  }
} as const;

type MagicMcpServerProviderInput = {
  providerId?: string;
  providerDeploymentId?: string;
  providerConfigId?: string | null;
  providerAuthConfigId?: string | null;
  toolFilters?: PrismaJson.ToolFilter | null;
};

let getBackingScopeWhere = (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
}) => ({
  integrationInstance: {
    tenantOid: d.tenant.oid,
    solutionOid: d.solution.oid,
    environmentOid: d.environment.oid
  }
});

let loadMagicMcpServerBackingForProviders = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerBackingId: string;
}) => {
  let backing = await db.magicMcpServerBacking.findFirst({
    where: {
      id: d.magicMcpServerBackingId,
      ...getBackingScopeWhere(d)
    },
    include: {
      providerTemplateBacking: { include: { integration: true } },
      ownerIntegration: true,
      integration: true,
      integrationInstance: true
    }
  });
  if (!backing) {
    throw new ServiceError(
      notFoundError('magic_mcp.server_backing', d.magicMcpServerBackingId)
    );
  }

  return backing;
};

let getMagicMcpServerProviderOrThrow = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerProviderId: string;
  allowDeleted?: boolean;
}) => {
  let row = await db.magicMcpServerProvider.findFirst({
    where: {
      id: d.magicMcpServerProviderId,
      magicMcpServerBacking: getBackingScopeWhere(d),
      ...normalizeStatusForGet(d).noParent
    },
    include: magicMcpServerProviderInclude
  });
  if (!row) {
    throw new ServiceError(
      notFoundError('magic_mcp.server_provider', d.magicMcpServerProviderId)
    );
  }

  return row;
};

let assertCanArchiveMagicMcpServerProvider = (d: {
  row: MagicMcpServerProvider;
  policy: ReturnType<typeof resolveMagicMcpBackingPolicy>;
}) => {
  if (d.policy.canArchiveProviders) return;

  throw new ServiceError(
    badRequestError({
      message: 'Inherited magic MCP server providers cannot be removed.',
      code: 'magic_mcp_server_provider_inherited'
    })
  );
};

let assertCanMutateIntegrationProvider = (
  policy: ReturnType<typeof resolveMagicMcpBackingPolicy>
) => {
  if (policy.canMutateIntegrationProviders) return;

  throw new ServiceError(
    badRequestError({
      message:
        'This magic MCP server inherits its integration providers and those providers cannot be changed directly.',
      code: 'magic_mcp_server_provider_inherited'
    })
  );
};

let assertCanMutateIntegrationInstanceProvider = (
  policy: ReturnType<typeof resolveMagicMcpBackingPolicy>
) => {
  if (policy.canMutateIntegrationInstanceProviders) return;

  throw new ServiceError(
    badRequestError({
      message:
        'This magic MCP server is linked to an integration instance and its providers cannot be changed directly.',
      code: 'magic_mcp_server_provider_linked'
    })
  );
};

let resolveIntegrationProviderMaterialInput = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: Pick<
    MagicMcpServerProviderInput,
    'providerDeploymentId' | 'providerConfigId' | 'providerAuthConfigId'
  >;
}) => {
  if (
    !d.input.providerDeploymentId &&
    !d.input.providerConfigId &&
    !d.input.providerAuthConfigId
  ) {
    return {};
  }

  let [combination] = await providerCombinationService.getCombinationsInternal({
    tenant: d.tenant,
    environment: d.environment,
    providers: [
      {
        deploymentId: d.input.providerDeploymentId,
        configId: d.input.providerConfigId ?? undefined,
        authConfigId: d.input.providerAuthConfigId ?? undefined
      }
    ]
  });

  let authConfig = combination.authConfig
    ? await db.providerAuthConfig.findFirstOrThrow({
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          oid: combination.authConfig.oid
        },
        include: {
          authMethod: true,
          authCredentials: true
        }
      })
    : null;

  return {
    providerDeploymentId: combination.deployment.id,
    providerAuthMethodId: authConfig?.authMethod.id,
    providerAuthCredentialsId: authConfig?.authCredentials?.id
  };
};

type ResolveMagicMcpServerBackingIdsParams = {
  allowDeleted?: boolean;
  status?: ('pending' | 'active' | 'archived' | 'deleted')[];
  providerIds?: string[];
};

type ListMagicMcpServerProvidersParams = {
  allowDeleted?: boolean;
  status?: ('pending' | 'active' | 'archived' | 'deleted')[];
  ids?: string[];
  magicMcpServerBackingIds?: string[];
  integrationProviderIds?: string[];
  integrationInstanceProviderIds?: string[];
  providerIds?: string[];
  providerDeploymentIds?: string[];
  providerConfigIds?: string[];
  providerAuthConfigIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetMagicMcpServerProviderByIdParams = {
  magicMcpServerProviderId: string;
  allowDeleted?: boolean;
};

type CreateMagicMcpServerProviderParams = {
  magicMcpServerBackingId: string;
  input: Required<Pick<MagicMcpServerProviderInput, 'providerId'>> &
    Omit<MagicMcpServerProviderInput, 'providerId'>;
};

type UpdateMagicMcpServerProviderParams = {
  magicMcpServerProviderId: string;
  input: MagicMcpServerProviderInput;
};

type ArchiveMagicMcpServerProviderParams = {
  magicMcpServerProviderId: string;
};

class magicMcpServerProviderServiceImpl {
  async resolveMagicMcpServerBackingIds(
    d: MetorialFacing<ResolveMagicMcpServerBackingIdsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.resolveMagicMcpServerBackingIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async resolveMagicMcpServerBackingIdsInternal(
    d: { tenant: Tenant; environment: Environment } & ResolveMagicMcpServerBackingIdsParams
  ) {
    if (!d.providerIds?.length) return [];

    let solution = await getMetorialSolution();
    let scoped = { tenant: d.tenant, solution, environment: d.environment };

    let rows = await db.magicMcpServerProvider.findMany({
      where: {
        magicMcpServerBacking: getBackingScopeWhere(scoped),
        status: normalizeStatusForList(d).noParent.status as any,
        integrationProvider: {
          provider: {
            id: { in: d.providerIds }
          }
        }
      },
      select: {
        magicMcpServerBacking: {
          select: {
            id: true
          }
        }
      }
    });

    return [...new Set(rows.map(row => row.magicMcpServerBacking.id))].sort();
  }

  async listMagicMcpServerProviders(d: MetorialFacing<ListMagicMcpServerProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listMagicMcpServerProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listMagicMcpServerProvidersInternal(
    d: { tenant: Tenant; environment: Environment } & ListMagicMcpServerProvidersParams
  ) {
    let solution = await getMetorialSolution();
    let scoped = { tenant: d.tenant, solution, environment: d.environment };

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpServerProvider.findMany({
          ...opts,
          where: {
            magicMcpServerBacking: {
              ...getBackingScopeWhere(scoped),
              id: d.magicMcpServerBackingIds?.length
                ? { in: d.magicMcpServerBackingIds }
                : undefined
            },
            id: d.ids?.length ? { in: d.ids } : undefined,
            status: normalizeStatusForList(d).noParent.status as any,
            integrationProvider: {
              id: d.integrationProviderIds?.length
                ? { in: d.integrationProviderIds }
                : undefined,
              provider: {
                id: d.providerIds?.length ? { in: d.providerIds } : undefined
              },
              currentVersion: {
                deployment: d.providerDeploymentIds?.length
                  ? { id: { in: d.providerDeploymentIds } }
                  : undefined
              }
            },
            integrationInstanceProvider: d.integrationInstanceProviderIds?.length
              ? {
                  id: { in: d.integrationInstanceProviderIds },
                  currentVersion: {
                    config: d.providerConfigIds?.length
                      ? { id: { in: d.providerConfigIds } }
                      : undefined,
                    authConfig: d.providerAuthConfigIds?.length
                      ? { id: { in: d.providerAuthConfigIds } }
                      : undefined
                  }
                }
              : d.providerConfigIds?.length || d.providerAuthConfigIds?.length
                ? {
                    currentVersion: {
                      config: d.providerConfigIds?.length
                        ? { id: { in: d.providerConfigIds } }
                        : undefined,
                      authConfig: d.providerAuthConfigIds?.length
                        ? { id: { in: d.providerAuthConfigIds } }
                        : undefined
                    }
                  }
                : undefined,
            createdAt: normalizeDateFilter(d.createdAt),
            updatedAt: normalizeDateFilter(d.updatedAt)
          },
          include: magicMcpServerProviderInclude
        });
      })
    );
  }

  async getMagicMcpServerProviderById(d: MetorialFacing<GetMagicMcpServerProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getMagicMcpServerProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getMagicMcpServerProviderByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetMagicMcpServerProviderByIdParams
  ) {
    let solution = await getMetorialSolution();
    let scoped = { tenant: d.tenant, solution, environment: d.environment };

    return await getMagicMcpServerProviderOrThrow({
      ...scoped,
      magicMcpServerProviderId: d.magicMcpServerProviderId,
      allowDeleted: d.allowDeleted
    });
  }

  async createMagicMcpServerProvider(d: MetorialFacing<CreateMagicMcpServerProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.createMagicMcpServerProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createMagicMcpServerProviderInternal(
    d: { tenant: Tenant; environment: Environment } & CreateMagicMcpServerProviderParams
  ) {
    let solution = await getMetorialSolution();
    let scoped = {
      tenant: d.tenant,
      solution,
      environment: d.environment,
      magicMcpServerBackingId: d.magicMcpServerBackingId
    };

    let created = await withTransaction(async () => {
      let backing = await loadMagicMcpServerBackingForProviders(scoped);
      let policy = resolveMagicMcpBackingPolicy(backing);
      assertCanMutateIntegrationProvider(policy);

      let ownerIntegration = getMagicMcpOwnerIntegration(backing);
      if (!ownerIntegration) {
        throw new ServiceError(notFoundError('integration'));
      }

      let materialInput = await resolveIntegrationProviderMaterialInput({
        tenant: d.tenant,
        solution,
        environment: d.environment,
        input: d.input
      });

      let integrationProvider =
        await integrationProviderService.createIntegrationProviderInternal({
          tenant: d.tenant,
          environment: d.environment,
          integration: ownerIntegration,
          input: {
            providerId: d.input.providerId,
            providerDeploymentId: materialInput.providerDeploymentId,
            providerAuthMethodId: materialInput.providerAuthMethodId,
            providerAuthCredentialsId: materialInput.providerAuthCredentialsId,
            providerConfigId: d.input.providerConfigId ?? undefined,
            toolFilters: d.input.toolFilters
          }
        });

      await integrationInstanceProviderService.setIntegrationInstanceProviderInternal({
        tenant: d.tenant,
        environment: d.environment,
        integrationInstance: backing.integrationInstance,
        input: {
          providerId: integrationProvider.id,
          providerDeploymentId: materialInput.providerDeploymentId,
          providerConfigId: d.input.providerConfigId ?? null,
          providerAuthConfigId: d.input.providerAuthConfigId ?? undefined,
          toolFilters: d.input.toolFilters
        }
      });

      return { backingOid: backing.oid, integrationProviderOid: integrationProvider.oid };
    });

    return await db.magicMcpServerProvider.findFirstOrThrow({
      where: {
        magicMcpServerBackingOid: created.backingOid,
        integrationProviderOid: created.integrationProviderOid
      },
      include: magicMcpServerProviderInclude
    });
  }

  async updateMagicMcpServerProvider(d: MetorialFacing<UpdateMagicMcpServerProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateMagicMcpServerProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateMagicMcpServerProviderInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateMagicMcpServerProviderParams
  ) {
    let solution = await getMetorialSolution();
    let scoped = {
      tenant: d.tenant,
      solution,
      environment: d.environment,
      magicMcpServerProviderId: d.magicMcpServerProviderId
    };

    await withTransaction(async () => {
      let row = await getMagicMcpServerProviderOrThrow(scoped);
      let policy = resolveMagicMcpBackingPolicy(row.magicMcpServerBacking);
      let backing = await loadMagicMcpServerBackingForProviders({
        tenant: d.tenant,
        solution,
        environment: d.environment,
        magicMcpServerBackingId: row.magicMcpServerBacking.id
      });

      let providerAuthMethodId: string | null | undefined;
      let providerAuthCredentialsId: string | null | undefined;
      let providerDeploymentId =
        d.input.providerDeploymentId ?? row.integrationProvider.currentVersion?.deployment.id;

      if (d.input.providerAuthConfigId === null) {
        providerAuthMethodId = null;
        providerAuthCredentialsId = null;
      } else if (d.input.providerAuthConfigId !== undefined) {
        let materialInput = await resolveIntegrationProviderMaterialInput({
          tenant: d.tenant,
          solution,
          environment: d.environment,
          input: {
            providerDeploymentId,
            providerAuthConfigId: d.input.providerAuthConfigId
          }
        });
        providerAuthMethodId = materialInput.providerAuthMethodId;
        providerAuthCredentialsId = materialInput.providerAuthCredentialsId ?? null;
        providerDeploymentId = materialInput.providerDeploymentId ?? providerDeploymentId;
      }

      if (policy.canMutateIntegrationProviders) {
        await integrationProviderService.updateIntegrationProviderInternal({
          tenant: d.tenant,
          environment: d.environment,
          integrationProvider: row.integrationProvider,
          input: {
            providerDeploymentId,
            providerAuthMethodId,
            providerAuthCredentialsId,
            providerConfigId:
              d.input.providerConfigId === undefined ? undefined : d.input.providerConfigId,
            toolFilters: d.input.toolFilters
          }
        });
      } else if (d.input.providerDeploymentId !== undefined) {
        throw new ServiceError(
          badRequestError({
            message: 'Inherited magic MCP server providers cannot change deployments.',
            code: 'magic_mcp_server_provider_inherited'
          })
        );
      }

      assertCanMutateIntegrationInstanceProvider(policy);

      await integrationInstanceProviderService.setIntegrationInstanceProviderInternal({
        tenant: d.tenant,
        environment: d.environment,
        integrationInstance: backing.integrationInstance,
        input: {
          providerId: row.integrationProvider.id,
          providerDeploymentId: d.input.providerDeploymentId,
          providerConfigId:
            d.input.providerConfigId === undefined ? undefined : d.input.providerConfigId,
          providerAuthConfigId: d.input.providerAuthConfigId ?? undefined,
          toolFilters: d.input.toolFilters
        }
      });
    });

    return await getMagicMcpServerProviderOrThrow({ ...scoped, allowDeleted: true });
  }

  async archiveMagicMcpServerProvider(d: MetorialFacing<ArchiveMagicMcpServerProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.archiveMagicMcpServerProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveMagicMcpServerProviderInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveMagicMcpServerProviderParams
  ) {
    let solution = await getMetorialSolution();
    let scoped = {
      tenant: d.tenant,
      solution,
      environment: d.environment,
      magicMcpServerProviderId: d.magicMcpServerProviderId
    };

    await withTransaction(async db => {
      let row = await getMagicMcpServerProviderOrThrow(scoped);
      checkDeletedEdit(row, 'archive');

      let policy = resolveMagicMcpBackingPolicy(row.magicMcpServerBacking);
      assertCanArchiveMagicMcpServerProvider({ row, policy });

      if (row.integrationInstanceProvider) {
        await integrationInstanceProviderService.archiveIntegrationInstanceProviderInternal({
          tenant: d.tenant,
          environment: d.environment,
          integrationInstanceProvider: row.integrationInstanceProvider
        });
      }

      let remainingActive = await db.integrationInstanceProvider.findFirst({
        where: {
          integrationProviderOid: row.integrationProvider.oid,
          status: 'active',
          isParentDeleted: false,
          oid: row.integrationInstanceProvider?.oid
            ? { not: row.integrationInstanceProvider.oid }
            : undefined
        }
      });
      if (!remainingActive) {
        await integrationProviderService.archiveIntegrationProviderInternal({
          tenant: d.tenant,
          environment: d.environment,
          integrationProvider: row.integrationProvider
        });
      }
    });

    return await getMagicMcpServerProviderOrThrow({ ...scoped, allowDeleted: true });
  }

  async deleteMagicMcpServerProvider(d: MetorialFacing<ArchiveMagicMcpServerProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.deleteMagicMcpServerProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async deleteMagicMcpServerProviderInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveMagicMcpServerProviderParams
  ) {
    return await this.archiveMagicMcpServerProviderInternal(d);
  }
}

export let magicMcpServerProviderService = Service.create(
  'magicMcpServerProvider',
  () => new magicMcpServerProviderServiceImpl()
).build();
