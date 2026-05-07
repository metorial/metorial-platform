import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  getId,
  type IntegrationInstance,
  type IntegrationProvider,
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
import { integrationInclude } from '../integration';
import { integrationInstanceProviderInclude } from '../integrationInstance';
import { integrationInstanceProviderService } from '../integrationInstanceProvider';
import {
  integrationProviderInclude,
  integrationProviderService
} from '../integrationProvider';
import {
  getMagicMcpOwnerIntegration,
  getMagicMcpOwnerType,
  magicMcpServerBackingInclude,
  withMagicMcpBackingLock
} from './shared';

export let magicMcpServerProviderInclude = {
  magicMcpServerBacking: {
    include: magicMcpServerBackingInclude
  },
  integrationProvider: {
    include: integrationProviderInclude
  },
  integrationInstanceProvider: {
    include: integrationInstanceProviderInclude
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
      providerTemplateBacking: {
        include: {
          integration: { include: integrationInclude }
        }
      },
      ownerIntegration: {
        include: integrationInclude
      },
      integration: {
        include: integrationInclude
      },
      integrationInstance: {
        include: {
          integrationInstanceProviders: {
            include: integrationInstanceProviderInclude
          }
        }
      },
      sessionTemplate: true,
      ephemeralManagedSession: true,
      actor: true
    }
  });
  if (!backing) {
    throw new ServiceError(
      notFoundError('magic_mcp.server_backing', d.magicMcpServerBackingId)
    );
  }

  return backing;
};

let getRowStatus = (d: {
  integrationProvider: Pick<IntegrationProvider, 'status'>;
  integrationInstanceProvider:
    | NonNullable<
        Awaited<
          ReturnType<typeof loadMagicMcpServerBackingForProviders>
        >['integrationInstance']['integrationInstanceProviders'][number]
      >
    | null
    | undefined;
}) => {
  if (d.integrationProvider.status === 'deleted') return 'deleted' as const;
  if (d.integrationProvider.status !== 'active') return 'archived' as const;
  if (
    d.integrationInstanceProvider &&
    d.integrationInstanceProvider.status === 'active' &&
    !d.integrationInstanceProvider.isParentDeleted
  ) {
    return 'active' as const;
  }

  return 'pending' as const;
};

export let reconcileMagicMcpServerProvidersForBackingWithoutLock = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerBackingId: string;
}) => {
  let backing = await loadMagicMcpServerBackingForProviders(d);
  let ownerIntegration = getMagicMcpOwnerIntegration(backing);
  if (!ownerIntegration) {
    return [];
  }

  let existingRows = await db.magicMcpServerProvider.findMany({
    where: {
      magicMcpServerBackingOid: backing.oid
    },
    include: {
      integrationProvider: true,
      integrationInstanceProvider: true
    }
  });
  let existingRowsByIntegrationProviderOid = new Map(
    existingRows.map(row => [row.integrationProviderOid, row])
  );
  let activeInstanceProvidersByIntegrationProviderOid = new Map(
    backing.integrationInstance.integrationInstanceProviders
      .filter(provider => provider.status === 'active' && !provider.isParentDeleted)
      .map(provider => [provider.integrationProviderOid, provider])
  );
  let touchedIntegrationProviderOids = new Set<bigint>();

  for (let integrationProvider of ownerIntegration.providers) {
    touchedIntegrationProviderOids.add(integrationProvider.oid);
    let existingRow = existingRowsByIntegrationProviderOid.get(integrationProvider.oid);
    let integrationInstanceProvider =
      activeInstanceProvidersByIntegrationProviderOid.get(integrationProvider.oid) ?? null;
    let status = getRowStatus({
      integrationProvider,
      integrationInstanceProvider
    });

    if (existingRow) {
      await db.magicMcpServerProvider.update({
        where: { oid: existingRow.oid },
        data: {
          status,
          archivedAt: status === 'archived' || status === 'deleted' ? new Date() : null,
          integrationInstanceProviderOid: integrationInstanceProvider?.oid ?? null
        }
      });
      continue;
    }
    await db.magicMcpServerProvider.create({
      data: {
        ...getId('magicMcpServerProvider'),
        status,
        archivedAt: status === 'archived' || status === 'deleted' ? new Date() : null,
        magicMcpServerBackingOid: backing.oid,
        integrationProviderOid: integrationProvider.oid,
        integrationInstanceProviderOid: integrationInstanceProvider?.oid ?? null
      }
    });
  }

  for (let existingRow of existingRows) {
    if (touchedIntegrationProviderOids.has(existingRow.integrationProviderOid)) continue;

    let status =
      existingRow.integrationProvider.status === 'deleted'
        ? ('deleted' as const)
        : ('archived' as const);
    await db.magicMcpServerProvider.update({
      where: { oid: existingRow.oid },
      data: {
        status,
        archivedAt: existingRow.archivedAt ?? new Date()
      }
    });
  }

  return await db.magicMcpServerProvider.findMany({
    where: {
      magicMcpServerBackingOid: backing.oid
    },
    include: magicMcpServerProviderInclude
  });
};

export let reconcileMagicMcpServerProvidersForBackingWithExistingLock =
  reconcileMagicMcpServerProvidersForBackingWithoutLock;

export let reconcileMagicMcpServerProvidersForBacking = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerBackingId: string;
}) =>
  await withMagicMcpBackingLock(
    getMagicMcpServerBackingLockKey(d),
    async () =>
      await withTransaction(
        async () => await reconcileMagicMcpServerProvidersForBackingWithoutLock(d)
      )
  );

let getMagicMcpServerBackingLockKey = (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerBackingId: string;
}) => `server:${d.magicMcpServerBackingId}`;

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

let getMagicMcpServerProviderByIdentityOrThrow = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  magicMcpServerBackingOid: bigint;
  integrationProviderOid: bigint;
  allowDeleted?: boolean;
  preferredMagicMcpServerProviderId?: string;
}) => {
  let rows = await db.magicMcpServerProvider.findMany({
    where: {
      magicMcpServerBackingOid: d.magicMcpServerBackingOid,
      integrationProviderOid: d.integrationProviderOid,
      magicMcpServerBacking: getBackingScopeWhere(d),
      ...normalizeStatusForGet(d).noParent
    },
    include: magicMcpServerProviderInclude
  });
  if (rows.length === 0) {
    throw new ServiceError(
      notFoundError(
        'magic_mcp.server_provider',
        d.preferredMagicMcpServerProviderId ?? String(d.integrationProviderOid)
      )
    );
  }

  let preferredRow = d.preferredMagicMcpServerProviderId
    ? rows.find(row => row.id === d.preferredMagicMcpServerProviderId)
    : null;
  if (preferredRow) return preferredRow;

  let activeRow = rows.find(row => row.status === 'active');
  if (activeRow) return activeRow;

  return rows[0]!;
};

let assertCanArchiveMagicMcpServerProvider = (d: {
  row: MagicMcpServerProvider;
  ownerType: ReturnType<typeof getMagicMcpOwnerType>;
}) => {
  if (d.ownerType === 'server_owned') return;

  throw new ServiceError(
    badRequestError({
      message: 'Inherited magic MCP server providers cannot be removed.',
      code: 'magic_mcp_server_provider_inherited'
    })
  );
};

let assertCanMutateIntegrationProvider = (
  ownerType: ReturnType<typeof getMagicMcpOwnerType>
) => {
  if (ownerType === 'server_owned') return;

  throw new ServiceError(
    badRequestError({
      message:
        'This magic MCP server inherits its integration providers and those providers cannot be changed directly.',
      code: 'magic_mcp_server_provider_inherited'
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

  let [combination] = await providerCombinationService.getCombinations({
    tenant: d.tenant,
    solution: d.solution,
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

class magicMcpServerProviderServiceImpl {
  async listMagicMcpServerProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
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
  }) {
    for (let magicMcpServerBackingId of d.magicMcpServerBackingIds ?? []) {
      await reconcileMagicMcpServerProvidersForBacking({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingId
      });
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpServerProvider.findMany({
          ...opts,
          where: {
            magicMcpServerBacking: {
              ...getBackingScopeWhere(d),
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

  async getMagicMcpServerProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerProviderId: string;
    allowDeleted?: boolean;
  }) {
    let existing = await getMagicMcpServerProviderOrThrow(d);
    await reconcileMagicMcpServerProvidersForBacking({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      magicMcpServerBackingId: existing.magicMcpServerBacking.id
    });

    try {
      return await getMagicMcpServerProviderByIdentityOrThrow({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingOid: existing.magicMcpServerBackingOid,
        integrationProviderOid: existing.integrationProviderOid,
        allowDeleted: d.allowDeleted,
        preferredMagicMcpServerProviderId: existing.id
      });
    } catch (error) {
      return await getMagicMcpServerProviderOrThrow({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerProviderId: existing.id,
        allowDeleted: true
      });
    }
  }

  async createMagicMcpServerProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerBackingId: string;
    input: Required<Pick<MagicMcpServerProviderInput, 'providerId'>> &
      Omit<MagicMcpServerProviderInput, 'providerId'>;
  }) {
    let created = await withMagicMcpBackingLock(
      getMagicMcpServerBackingLockKey(d),
      async () => {
        let created = await withTransaction(async () => {
          let backing = await loadMagicMcpServerBackingForProviders(d);
          let ownerType = getMagicMcpOwnerType(backing);
          assertCanMutateIntegrationProvider(ownerType);

          let ownerIntegration = getMagicMcpOwnerIntegration(backing);
          if (!ownerIntegration) {
            throw new ServiceError(notFoundError('integration'));
          }

          let materialInput = await resolveIntegrationProviderMaterialInput({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            input: d.input
          });

          let integrationProvider = await integrationProviderService.createIntegrationProvider(
            {
              tenant: d.tenant,
              solution: d.solution,
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
            }
          );

          await integrationInstanceProviderService.setIntegrationInstanceProvider({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            integrationInstance: backing.integrationInstance as IntegrationInstance,
            input: {
              providerId: integrationProvider.id,
              providerDeploymentId: materialInput.providerDeploymentId,
              providerConfigId: d.input.providerConfigId ?? null,
              providerAuthConfigId: d.input.providerAuthConfigId ?? undefined,
              toolFilters: d.input.toolFilters
            }
          });

          return {
            backingOid: backing.oid,
            magicMcpServerBackingId: backing.id,
            integrationProviderOid: integrationProvider.oid
          };
        });

        await reconcileMagicMcpServerProvidersForBackingWithExistingLock({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          magicMcpServerBackingId: created.magicMcpServerBackingId
        });

        return created;
      }
    );

    return await db.magicMcpServerProvider.findFirstOrThrow({
      where: {
        magicMcpServerBackingOid: created.backingOid,
        integrationProviderOid: created.integrationProviderOid
      },
      include: magicMcpServerProviderInclude
    });
  }

  async updateMagicMcpServerProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerProviderId: string;
    input: MagicMcpServerProviderInput;
  }) {
    let existing = await getMagicMcpServerProviderOrThrow(d);

    await withMagicMcpBackingLock(
      getMagicMcpServerBackingLockKey({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingId: existing.magicMcpServerBacking.id
      }),
      async () => {
        let updated = await withTransaction(async () => {
          let row = await getMagicMcpServerProviderOrThrow(d);
          let ownerType = getMagicMcpOwnerType(row.magicMcpServerBacking);
          let backing = await loadMagicMcpServerBackingForProviders({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            magicMcpServerBackingId: row.magicMcpServerBacking.id
          });
          let providerAuthMethodId: string | null | undefined;
          let providerAuthCredentialsId: string | null | undefined;
          let providerDeploymentId =
            d.input.providerDeploymentId ??
            row.integrationProvider.currentVersion?.deployment.id;

          if (d.input.providerAuthConfigId === null) {
            providerAuthMethodId = null;
            providerAuthCredentialsId = null;
          } else if (d.input.providerAuthConfigId !== undefined) {
            let materialInput = await resolveIntegrationProviderMaterialInput({
              tenant: d.tenant,
              solution: d.solution,
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

          if (ownerType === 'server_owned') {
            await integrationProviderService.updateIntegrationProvider({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integrationProvider: row.integrationProvider,
              input: {
                providerDeploymentId,
                providerAuthMethodId,
                providerAuthCredentialsId,
                providerConfigId:
                  d.input.providerConfigId === undefined
                    ? undefined
                    : d.input.providerConfigId,
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

          await integrationInstanceProviderService.setIntegrationInstanceProvider({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            integrationInstance: backing.integrationInstance as IntegrationInstance,
            input: {
              providerId: row.integrationProvider.id,
              providerDeploymentId: d.input.providerDeploymentId,
              providerConfigId:
                d.input.providerConfigId === undefined ? undefined : d.input.providerConfigId,
              providerAuthConfigId: d.input.providerAuthConfigId ?? undefined,
              toolFilters: d.input.toolFilters
            }
          });

          return { magicMcpServerBackingId: backing.id };
        });

        await reconcileMagicMcpServerProvidersForBackingWithExistingLock({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          magicMcpServerBackingId: updated.magicMcpServerBackingId
        });
      }
    );

    try {
      return await getMagicMcpServerProviderByIdentityOrThrow({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingOid: existing.magicMcpServerBackingOid,
        integrationProviderOid: existing.integrationProviderOid,
        preferredMagicMcpServerProviderId: existing.id
      });
    } catch (error) {
      return await getMagicMcpServerProviderOrThrow({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerProviderId: existing.id,
        allowDeleted: true
      });
    }
  }

  async archiveMagicMcpServerProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerProviderId: string;
  }) {
    let row = await getMagicMcpServerProviderOrThrow(d);
    checkDeletedEdit(row, 'archive');

    let ownerType = getMagicMcpOwnerType(row.magicMcpServerBacking);
    assertCanArchiveMagicMcpServerProvider({ row, ownerType });

    if (row.integrationInstanceProvider) {
      await integrationInstanceProviderService.archiveIntegrationInstanceProvider({
        tenant: d.tenant,
        solution: d.solution,
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
      await integrationProviderService.archiveIntegrationProvider({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationProvider: row.integrationProvider
      });
    }

    await reconcileMagicMcpServerProvidersForBacking({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      magicMcpServerBackingId: row.magicMcpServerBacking.id
    });

    return await getMagicMcpServerProviderOrThrow({
      ...d,
      allowDeleted: true
    });
  }

  async deleteMagicMcpServerProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerProviderId: string;
  }) {
    return await this.archiveMagicMcpServerProvider(d);
  }
}

export let magicMcpServerProviderService = Service.create(
  'magicMcpServerProvider',
  () => new magicMcpServerProviderServiceImpl()
).build();
