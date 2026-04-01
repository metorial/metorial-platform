import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Prisma,
  type Provider,
  type ProviderAuthCredentials,
  type ProviderAuthCredentialsStatus,
  type ProviderType,
  type ProviderVariant,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveAuthMethodsGlobal,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';
import { getManagedOAuthScopeIds, type ManagedOAuthScopes } from '../lib/managedOAuthScopes';
import {
  providerAuthCredentialsCreatedQueue,
  providerAuthCredentialsUpdatedQueue
} from '../queues/lifecycle/providerAuthCredentials';

let managedCredentialsInclude = {
  providerAuthMethod: true,
  providerAuthCredentials: {
    include: {
      provider: {
        include: {
          defaultVariant: true
        }
      }
    }
  }
};

let include = {
  provider: {
    include: {
      defaultVariant: true
    }
  },
  managedCredentials: {
    include: managedCredentialsInclude
  },
  managedCredentialsBacking: {
    include: {
      managedCredentials: {
        include: managedCredentialsInclude
      }
    }
  }
};

type ProviderAuthCredentialsRecord = Prisma.ProviderAuthCredentialsGetPayload<{
  include: typeof include;
}>;

let createDefaultLock = createLock({
  name: 'sub/auth/acred/def/lock',
  redisUrl: env.service.REDIS_URL
});

let createManagedBackingLock = createLock({
  name: 'sub/auth/acred/mng/backing/lock',
  redisUrl: env.service.REDIS_URL
});

interface CreateParams {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  provider: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    isEphemeral?: boolean;

    config:
      | {
          type: 'oauth';
          clientId: string;
          clientSecret: string;
          scopes: string[];
        }
      | {
          type: 'auto_registration';
        };
  };
}

type ProviderAuthCredentialsListOrigin = 'tenant_created' | 'managed_backing';

let defaultListOrigins: ProviderAuthCredentialsListOrigin[] = [
  'tenant_created',
  'managed_backing'
];

let getTenantOwnedWhere = (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
}) => ({
  tenantOid: d.tenant.oid,
  solutionOid: d.solution.oid,
  environmentOid: d.environment.oid,
  origin: 'tenant_created' as const
});

let getManagedWhere = (d: { solution: Solution }) => ({
  solutionOid: d.solution.oid,
  origin: 'managed_public' as const
});

let getManagedBackingWhere = (d: { tenant: Tenant; solution: Solution }) => ({
  tenantOid: d.tenant.oid,
  solutionOid: d.solution.oid,
  origin: 'managed_backing' as const
});

let getManagedBackingWhereForTenantList = (d: {
  tenant: Tenant;
  solution: Solution;
  providerAuthMethodIds?: string[];
  ids?: string[];
}) => ({
  ...getManagedBackingWhere(d),
  ...(d.ids !== undefined ? { id: { in: d.ids } } : {}),
  ...(d.providerAuthMethodIds?.length
    ? {
        managedCredentialsBacking: {
          is: {
            managedCredentials: {
              providerAuthMethod: {
                id: {
                  in: d.providerAuthMethodIds
                }
              }
            }
          }
        }
      }
    : {})
});

let getManagedPublicWhereForTenantPrefill = (d: {
  tenant: Tenant;
  solution: Solution;
  providerAuthMethodIds?: string[];
  ids?: string[];
}) => ({
  solutionOid: d.solution.oid,
  origin: 'managed_public' as const,
  managedCredentials: {
    is: {
      ...(d.providerAuthMethodIds?.length
        ? {
            providerAuthMethod: {
              id: {
                in: d.providerAuthMethodIds
              }
            }
          }
        : {}),
      ...(d.ids !== undefined
        ? {
            backings: {
              some: {
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                providerAuthCredentials: {
                  id: {
                    in: d.ids
                  }
                }
              }
            }
          }
        : {})
    }
  }
});

class providerAuthCredentialsServiceImpl {
  async listProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: ProviderAuthCredentialsStatus[];
    allowDeleted?: boolean;

    origin?: ProviderAuthCredentialsListOrigin[];
    search?: string;

    ids?: string[];
    providerIds?: string[];
    providerAuthMethodIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let authMethodsGlobal = await resolveAuthMethodsGlobal(d, d.providerAuthMethodIds);

    let origin = d.origin?.length ? d.origin : defaultListOrigins;
    let includeTenantCreated = origin.includes('tenant_created');
    let includeManagedBacking = origin.includes('managed_backing');
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.providerAuthCredentials.id,
          query: d.search,
          // managed_public never gets indexed; omit the origin filter if both types are passed
          filters: origin.length === 1 ? { origin: origin[0] } : undefined
        })
      : null;
    let searchIds = search?.map(r => r.documentId);
    let credentialIds =
      d.ids && searchIds ? d.ids.filter(id => searchIds.includes(id)) : (d.ids ?? searchIds);

    if (includeManagedBacking) {
      await this.ensureManagedProviderAuthCredentialsBackingsForTenantList({
        ...d,
        ids: credentialIds,
        providerOid: providers?.in
      });
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        if (credentialIds && credentialIds.length === 0) {
          return [];
        }

        let list = await db.providerAuthCredentials.findMany({
          ...opts,
          where: {
            isEphemeral: false,
            ...normalizeStatusForList(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
              providers ? { providerOid: providers.in } : undefined!,
              authMethodsGlobal
                ? {
                    provider: {
                      providerAuthMethodGlobals: {
                        some: authMethodsGlobal.oidIn
                      }
                    }
                  }
                : undefined!,

              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!,

              {
                OR: [
                  includeTenantCreated
                    ? {
                        ...getTenantOwnedWhere(d),
                        ...(credentialIds ? { id: { in: credentialIds } } : {})
                      }
                    : undefined!,
                  includeManagedBacking
                    ? getManagedBackingWhereForTenantList({
                        ...d,
                        ids: credentialIds
                      })
                    : undefined!
                ].filter(Boolean)
              }
            ] // .filter(Boolean)
          },
          include
        });

        return list;
      })
    );
  }

  async getProviderAuthCredentialsById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthCredentialsId: string;
    allowDeleted?: boolean;
  }) {
    let providerAuthCredentials = await db.providerAuthCredentials.findFirst({
      where: {
        id: d.providerAuthCredentialsId,
        ...normalizeStatusForGet(d).noParent,
        OR: [getTenantOwnedWhere(d), getManagedWhere(d), getManagedBackingWhere(d)]
      },
      include
    });
    if (!providerAuthCredentials) {
      throw new ServiceError(
        notFoundError('provider.auth_credentials', d.providerAuthCredentialsId)
      );
    }

    return await this.getProviderAuthCredentialsForTenantRead({
      tenant: d.tenant,
      solution: d.solution,
      providerAuthCredentials
    });
  }

  private async ensureManagedProviderAuthCredentialsBackingsForTenantList(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    status?: ProviderAuthCredentialsStatus[];
    allowDeleted?: boolean;
    providerAuthMethodIds?: string[];
    ids?: string[];
    providerOid?: {
      in: bigint[];
    };
  }) {
    let managedPublicCredentials = await db.providerAuthCredentials.findMany({
      where: {
        isEphemeral: false,
        ...normalizeStatusForList(d).noParent,
        AND: [
          getManagedPublicWhereForTenantPrefill(d),
          d.providerOid ? { providerOid: d.providerOid } : undefined!
        ].filter(Boolean)
      },
      include: {
        provider: {
          include: {
            defaultVariant: true
          }
        },
        managedCredentials: {
          include: {
            providerAuthMethod: true,
            backings: {
              where: {
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid
              },
              take: 1,
              include: {
                providerAuthCredentials: {
                  select: {
                    updatedAt: true
                  }
                }
              }
            }
          }
        }
      }
    });

    await Promise.all(
      managedPublicCredentials
        .filter(providerAuthCredentials => {
          let backing =
            providerAuthCredentials.managedCredentials!.backings[0]?.providerAuthCredentials;

          if (!backing) {
            return true;
          }

          let syncAfter = Math.max(
            providerAuthCredentials.updatedAt.getTime(),
            providerAuthCredentials.managedCredentials!.updatedAt.getTime()
          );

          return backing.updatedAt.getTime() < syncAfter;
        })
        .map(providerAuthCredentials =>
          this.ensureManagedProviderAuthCredentialsBacking({
            tenant: d.tenant,
            solution: d.solution,
            provider: providerAuthCredentials.provider,
            providerAuthCredentials,
            providerAuthMethod: providerAuthCredentials.managedCredentials!.providerAuthMethod
          })
        )
    );
  }

  async updateProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthCredentials: ProviderAuthCredentials;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerAuthCredentials);
    checkDeletedEdit(d.providerAuthCredentials, 'update');

    if (d.providerAuthCredentials.origin !== 'tenant_created') {
      throw new ServiceError(
        badRequestError({
          message: 'Managed credentials cannot be modified through tenant APIs',
          code: 'managed_credentials_readonly'
        })
      );
    }

    return withTransaction(async db => {
      let creds = await db.providerAuthCredentials.update({
        where: {
          oid: d.providerAuthCredentials.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerAuthCredentials.name,
          description: d.input.description ?? d.providerAuthCredentials.description,
          metadata: d.input.metadata ?? d.providerAuthCredentials.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsUpdatedQueue.add({ providerAuthCredentialsId: creds.id })
      );

      return creds;
    });
  }

  async createProviderAuthCredentials(d: CreateParams) {
    return this.createProviderAuthCredentialsInner(d);
  }

  async ensureDefaultProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
  }) {
    let getExisting = () =>
      db.providerAuthCredentials.findFirst({
        where: {
          ...getTenantOwnedWhere(d),
          providerOid: d.provider.oid,
          isDefault: true,
          status: 'active'
        },
        include
      });

    let existing = await getExisting();
    if (existing) return existing;

    return await createDefaultLock.usingLock([d.provider.id], async () => {
      let lockedExisting = await getExisting();
      if (lockedExisting) return lockedExisting;

      return this.createProviderAuthCredentialsInner({
        ...d,
        isDefault: true,
        input: {
          name: `Default credentials for ${d.provider.name}`,
          config: { type: 'auto_registration' }
        }
      });
    });
  }

  async getProviderAuthCredentialsForBackendUse(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerAuthCredentials: ProviderAuthCredentials;
    providerAuthMethod: {
      oid: bigint;
    };
  }) {
    let managedCredentials = await this.getManagedProviderAuthCredentialsContext(d);
    if (!managedCredentials) {
      return d.providerAuthCredentials;
    }

    return this.ensureManagedProviderAuthCredentialsBacking({
      tenant: d.tenant,
      solution: d.solution,
      provider: managedCredentials.provider,
      providerAuthCredentials: managedCredentials.providerAuthCredentials,
      providerAuthMethod: managedCredentials.providerAuthMethod
    });
  }

  private async ensureManagedProviderAuthCredentialsBacking(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerAuthCredentials: ProviderAuthCredentials;
    providerAuthMethod: {
      oid: bigint;
    };
  }) {
    let managedCredentialsOid = d.providerAuthCredentials.managedCredentialsOid!;
    let syncAfter = [d.providerAuthCredentials.updatedAt.getTime()];

    let managedCredentials = await db.managedProviderAuthCredentials.findFirstOrThrow({
      where: {
        oid: managedCredentialsOid,
        solutionOid: d.solution.oid
      }
    });
    syncAfter.push(managedCredentials.updatedAt.getTime());

    if (managedCredentials.providerAuthMethodOid !== d.providerAuthMethod.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Managed credentials can only be used with their configured auth method',
          code: 'managed_credentials_auth_method_mismatch'
        })
      );
    }

    let getExistingBacking = async () => {
      let backing = await db.managedProviderAuthCredentialsBacking.findUnique({
        where: {
          managedCredentialsOid_tenantOid: {
            managedCredentialsOid,
            tenantOid: d.tenant.oid
          }
        },
        include: {
          providerAuthCredentials: {
            include
          }
        }
      });

      return backing?.providerAuthCredentials ?? null;
    };

    let isBackingFresh = (
      backing: ProviderAuthCredentials | null
    ): backing is ProviderAuthCredentials =>
      !!backing && backing.updatedAt.getTime() >= Math.max(...syncAfter);

    let syncBacking = async (existing: ProviderAuthCredentials | null) => {
      let defaultVariant = d.provider.defaultVariant;
      if (!defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let backend = await getBackend({
        entity: {
          backendOid: defaultVariant.backendOid
        }
      });

      let backendProviderAuthCredentials = await backend.auth.createProviderAuthCredentials({
        tenant: d.tenant,
        provider: d.provider,
        input: {
          type: 'oauth',
          clientId: managedCredentials.oauthClientId,
          clientSecret: managedCredentials.oauthClientSecret,
          scopes: getManagedOAuthScopeIds(managedCredentials.oauthScopes as ManagedOAuthScopes)
        }
      });

      if (existing) {
        return await withTransaction(async db => {
          let updated = await db.providerAuthCredentials.update({
            where: {
              oid: existing.oid
            },
            data: {
              type: backendProviderAuthCredentials.type,
              status: managedCredentials.status === 'archived' ? 'archived' : 'active',
              origin: 'managed_backing',
              backendOid: backend.backend.oid,
              isAutoRegistration: backendProviderAuthCredentials.isAutoRegistration,
              slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials?.oid,
              shuttleCredentialsOid:
                backendProviderAuthCredentials.shuttleOAuthCredentials?.oid,
              name: d.providerAuthCredentials.name,
              description: d.providerAuthCredentials.description,
              metadata: d.providerAuthCredentials.metadata
            },
            include
          });

          await addAfterTransactionHook(async () =>
            providerAuthCredentialsUpdatedQueue.add({
              providerAuthCredentialsId: updated.id
            })
          );

          return updated;
        });
      }

      return await withTransaction(async db => {
        let backingCredentials = await db.providerAuthCredentials.create({
          data: {
            ...getId('providerAuthCredentials'),
            type: backendProviderAuthCredentials.type,
            status: managedCredentials.status === 'archived' ? 'archived' : 'active',
            origin: 'managed_backing',
            backendOid: backend.backend.oid,
            isAutoRegistration: backendProviderAuthCredentials.isAutoRegistration,
            slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials?.oid,
            shuttleCredentialsOid: backendProviderAuthCredentials.shuttleOAuthCredentials?.oid,
            name: d.providerAuthCredentials.name,
            description: d.providerAuthCredentials.description,
            metadata: d.providerAuthCredentials.metadata,
            isEphemeral: false,
            isDefault: false,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            providerOid: d.provider.oid
          },
          include
        });

        await db.managedProviderAuthCredentialsBacking.create({
          data: {
            oid: snowflake.nextId(),
            managedCredentialsOid,
            providerAuthCredentialsOid: backingCredentials.oid,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid
          }
        });

        await addAfterTransactionHook(async () =>
          providerAuthCredentialsCreatedQueue.add({
            providerAuthCredentialsId: backingCredentials.id
          })
        );

        return backingCredentials;
      });
    };

    let existingBacking = await getExistingBacking();
    if (isBackingFresh(existingBacking)) return existingBacking;

    return await createManagedBackingLock.usingLock(
      [String(managedCredentialsOid), d.tenant.id],
      async () => {
        let lockedExistingBacking = await getExistingBacking();
        if (isBackingFresh(lockedExistingBacking)) {
          return lockedExistingBacking;
        }

        return await syncBacking(lockedExistingBacking);
      }
    );
  }

  private async createProviderAuthCredentialsInner(d: CreateParams & { isDefault?: boolean }) {
    if (
      !d.provider.type.attributes.auth.oauth?.oauthAutoRegistration &&
      d.input.config.type === 'auto_registration'
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider does not support auto registration auth credentials',
          code: 'auto_registration_not_supported'
        })
      );
    }

    return await withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant
      });

      let backendProviderAuthCredentials = await backend.auth.createProviderAuthCredentials({
        tenant: d.tenant,
        provider: d.provider,
        input: d.input.config
      });

      let providerAuthCredentials = await db.providerAuthCredentials.create({
        data: {
          ...getId('providerAuthCredentials'),

          type: backendProviderAuthCredentials.type,
          status: 'active',
          origin: 'tenant_created',

          backendOid: backend.backend.oid,
          isAutoRegistration: backendProviderAuthCredentials.isAutoRegistration,

          slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials?.oid,
          shuttleCredentialsOid: backendProviderAuthCredentials.shuttleOAuthCredentials?.oid,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.isDefault,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid
        },
        include
      });

      if (providerAuthCredentials.isDefault) {
        await db.providerAuthCredentials.updateMany({
          where: {
            ...getTenantOwnedWhere(d),
            providerOid: d.provider.oid,
            oid: {
              not: providerAuthCredentials.oid
            },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsCreatedQueue.add({
          providerAuthCredentialsId: providerAuthCredentials.id
        })
      );

      return providerAuthCredentials;
    });
  }

  private async getManagedProviderAuthCredentialsContext(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthCredentials: ProviderAuthCredentials;
  }) {
    if (d.providerAuthCredentials.origin === 'managed_public') {
      let managedCredentials = await db.managedProviderAuthCredentials.findFirstOrThrow({
        where: {
          oid: d.providerAuthCredentials.managedCredentialsOid!,
          solutionOid: d.solution.oid
        },
        include: managedCredentialsInclude
      });

      let publicCredential = managedCredentials.providerAuthCredentials!;

      return {
        provider: publicCredential.provider,
        providerAuthCredentials: publicCredential,
        providerAuthMethod: managedCredentials.providerAuthMethod
      };
    }

    if (d.providerAuthCredentials.origin !== 'managed_backing') {
      return null;
    }

    let managedBacking = await db.managedProviderAuthCredentialsBacking.findFirstOrThrow({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        providerAuthCredentialsOid: d.providerAuthCredentials.oid
      },
      include: {
        managedCredentials: {
          include: managedCredentialsInclude
        }
      }
    });

    let publicCredential = managedBacking.managedCredentials.providerAuthCredentials!;

    return {
      provider: publicCredential.provider,
      providerAuthCredentials: publicCredential,
      providerAuthMethod: managedBacking.managedCredentials.providerAuthMethod
    };
  }

  private async getProviderAuthCredentialsForTenantRead(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthCredentials: ProviderAuthCredentialsRecord;
  }) {
    if (d.providerAuthCredentials.origin === 'managed_backing') {
      let managedCredentials =
        d.providerAuthCredentials.managedCredentialsBacking!.managedCredentials;
      let publicCredential = managedCredentials.providerAuthCredentials!;

      return this.ensureManagedProviderAuthCredentialsBacking({
        tenant: d.tenant,
        solution: d.solution,
        provider: publicCredential.provider,
        providerAuthCredentials: publicCredential,
        providerAuthMethod: managedCredentials.providerAuthMethod
      });
    }

    if (d.providerAuthCredentials.origin === 'tenant_created') {
      return d.providerAuthCredentials;
    }

    return this.ensureManagedProviderAuthCredentialsBacking({
      tenant: d.tenant,
      solution: d.solution,
      provider: d.providerAuthCredentials.provider,
      providerAuthCredentials: d.providerAuthCredentials,
      providerAuthMethod: d.providerAuthCredentials.managedCredentials!.providerAuthMethod
    });
  }
}

export let providerAuthCredentialsService = Service.create(
  'providerAuthCredentials',
  () => new providerAuthCredentialsServiceImpl()
).build();
