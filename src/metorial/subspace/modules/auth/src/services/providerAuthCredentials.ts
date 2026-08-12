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
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  assertNoActiveIntegrationInstanceProviderAuthCredentialsLink,
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveAuthMethodsGlobal,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  getMetorialSolution,
  checkTenant,
  type MetorialFacing,
  type MetorialFacingWithOptionalConsumerActor,
  resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';
import { normalizeManagedOAuthScopeIds } from '../lib/managedOAuthScopes';
import {
  ensureManagedProviderAuthCredentialsBacking,
  type ManagedProviderAuthCredentialsBackingSource
} from '../lib/managedProviderAuthCredentialsBacking';
import { managedProviderAuthCredentialsBackingSourceInclude } from '../lib/managedProviderAuthCredentialsBackingInclude';
import {
  providerAuthCredentialsArchivedQueue,
  providerAuthCredentialsCreatedQueue,
  providerAuthCredentialsUpdatedQueue
} from '../queues/lifecycle/providerAuthCredentials';

let managedCredentialsInclude = {
  ...managedProviderAuthCredentialsBackingSourceInclude,
  providerAuthMethodGlobal: {
    include: {
      currentInstance: true
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

interface CreateParams {
  tenant: Tenant;
  environment: Environment;
  provider: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
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
  environment: Environment;
  solution: Solution;
}) => ({
  tenantOid: d.tenant.oid,
  solutionOid: d.solution.oid,
  environmentOid: d.environment.oid,
  origin: 'tenant_created' as const
});

let getManagedBackingWhere = (d: { tenant: Tenant; solution: Solution }) => ({
  tenantOid: d.tenant.oid,
  solutionOid: d.solution.oid,
  origin: 'managed_backing' as const
});

let getManagedBackingWhereForTenantList = (d: {
  tenant: Tenant;
  solution: Solution;
  providerAuthMethodGlobalOids?: bigint[];
  ids?: string[];
}) => ({
  ...getManagedBackingWhere({ tenant: d.tenant, solution: d.solution }),
  ...(d.ids !== undefined ? { id: { in: d.ids } } : {}),
  ...(d.providerAuthMethodGlobalOids?.length
    ? {
        managedCredentialsBacking: {
          is: {
            managedCredentials: {
              providerAuthMethodGlobalOid: {
                in: d.providerAuthMethodGlobalOids
              }
            }
          }
        }
      }
    : {})
});

export type UpdateProviderAuthCredentialsParams = {
  tenant: Tenant;
  environment: Environment;
  providerAuthCredentials: ProviderAuthCredentials;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    scopes?: string[];
    clientId?: string;
    clientSecret?: string;
  };
};

export type ArchiveProviderAuthCredentialsParams = {
  tenant: Tenant;
  environment: Environment;
  providerAuthCredentials: ProviderAuthCredentials;
};

type ListProviderAuthCredentialsParams = {
  status?: ProviderAuthCredentialsStatus[];
  allowDeleted?: boolean;

  origin?: ProviderAuthCredentialsListOrigin[];
  search?: string;

  ids?: string[];
  providerIds?: string[];
  providerAuthMethodIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetProviderAuthCredentialsByIdParams = {
  providerAuthCredentialsId: string;
  allowDeleted?: boolean;
};

type GetManyProviderAuthCredentialsByIdsParams = {
  ids: string[];
  allowDeleted?: boolean;
};

type SyncProviderAuthCredentialsScopesParams = {
  providerAuthCredentials: ProviderAuthCredentials;
};

type EnsureDefaultProviderAuthCredentialsParams = {
  provider: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
};

type GetProviderAuthCredentialsForBackendUseParams = {
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerAuthCredentials: ProviderAuthCredentials;
  providerAuthMethod: {
    globalOid: bigint;
  };
};

class providerAuthCredentialsServiceImpl {
  async createProviderAuthCredentials(
    d: MetorialFacingWithOptionalConsumerActor<CreateParams>
  ) {
    let { instance, organizationActor, consumer, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_credentials.created:before', eventBase);

    let authCredentials = await this.createProviderAuthCredentialsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_credentials.created:after', {
      ...eventBase,
      authCredentials
    });

    return authCredentials;
  }

  async updateProviderAuthCredentials(
    d: MetorialFacingWithOptionalConsumerActor<UpdateProviderAuthCredentialsParams>
  ) {
    let { instance, organizationActor, consumer, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_credentials.updated:before', eventBase);

    let authCredentials = await this.updateProviderAuthCredentialsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_credentials.updated:after', {
      ...eventBase,
      authCredentials
    });

    return authCredentials;
  }

  async archiveProviderAuthCredentials(
    d: MetorialFacingWithOptionalConsumerActor<ArchiveProviderAuthCredentialsParams>
  ) {
    let { instance, organizationActor, consumer, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_credentials.deleted:before', eventBase);

    let authCredentials = await this.archiveProviderAuthCredentialsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_credentials.deleted:after', {
      ...eventBase,
      authCredentials
    });

    return authCredentials;
  }

  async listProviderAuthCredentials(d: MetorialFacing<ListProviderAuthCredentialsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderAuthCredentialsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderAuthCredentialsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderAuthCredentialsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let authMethodsGlobal = await resolveAuthMethodsGlobal(ts, d.providerAuthMethodIds);

    let origin = d.origin?.length ? d.origin : defaultListOrigins;
    let includeTenantCreated = origin.includes('tenant_created');
    let includeManagedBacking = origin.includes('managed_backing');

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.providerAuthCredentials.id,
          query: d.search,
          // Legacy managed_public rows were never indexed; keep the filter logic origin-based.
          filters: origin.length === 1 ? { origin: origin[0] } : undefined
        })
      : null;
    let searchIds = search?.map(r => r.documentId);
    let credentialIds =
      d.ids && searchIds ? d.ids.filter(id => searchIds.includes(id)) : (d.ids ?? searchIds);

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
                        ...getTenantOwnedWhere({ ...d, solution }),
                        ...(credentialIds ? { id: { in: credentialIds } } : {})
                      }
                    : undefined!,
                  includeManagedBacking
                    ? getManagedBackingWhereForTenantList({
                        tenant: d.tenant,
                        solution,
                        ids: credentialIds,
                        providerAuthMethodGlobalOids: authMethodsGlobal?.oids
                      })
                    : undefined!
                ].filter(Boolean)
              }
            ].filter(Boolean)
          },
          include
        });

        return list;
      })
    );
  }

  async enrichWithScopes<T extends ProviderAuthCredentials>(
    d: MetorialFacing<{ credentials: T[] }>
  ): Promise<(T & { scopes: string[] | null })[]> {
    let { tenant } = await resolveMetorialFacing(d);

    let byBackend = new Map<bigint, T[]>();
    for (let cred of d.credentials) {
      let group = byBackend.get(cred.backendOid) ?? [];
      group.push(cred);
      byBackend.set(cred.backendOid, group);
    }

    let results = await Promise.all(
      Array.from(byBackend.entries()).map(async ([_, creds]) => {
        let backend = await getBackend({ entity: creds[0]! });
        let { scopes } = await backend.auth.getManyProviderAuthCredentialsScopes({
          tenant,
          backings: creds.map(c => ({
            id: c.id,
            slateCredentialsOid: c.slateCredentialsOid,
            shuttleCredentialsOid: c.shuttleCredentialsOid
          }))
        });

        return creds.map(c => ({
          ...c,
          scopes: scopes.get(c.id) ?? null
        }));
      })
    );

    return results.flat();
  }

  async getProviderAuthCredentialsById(
    d: MetorialFacing<GetProviderAuthCredentialsByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthCredentialsByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderAuthCredentialsByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderAuthCredentialsByIdParams
  ) {
    let solution = await getMetorialSolution();
    let providerAuthCredentials = await withTransaction(
      async db =>
        await db.providerAuthCredentials.findFirst({
          where: {
            id: d.providerAuthCredentialsId,
            ...normalizeStatusForGet(d).noParent,
            OR: [getTenantOwnedWhere({ ...d, solution }), getManagedBackingWhere({ tenant: d.tenant, solution })]
          },
          include
        }),
      { ifExists: true }
    );
    if (!providerAuthCredentials) {
      throw new ServiceError(
        notFoundError('provider.auth_credentials', d.providerAuthCredentialsId)
      );
    }

    return await this.getProviderAuthCredentialsForTenantRead({
      tenant: d.tenant,
      providerAuthCredentials
    });
  }

  async getManyProviderAuthCredentialsByIds(
    d: MetorialFacing<GetManyProviderAuthCredentialsByIdsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getManyProviderAuthCredentialsByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getManyProviderAuthCredentialsByIdsInternal(
    d: { tenant: Tenant; environment: Environment } & GetManyProviderAuthCredentialsByIdsParams
  ) {
    let solution = await getMetorialSolution();
    return await db.providerAuthCredentials.findMany({
      where: {
        id: { in: d.ids },
        ...normalizeStatusForGet(d).noParent,
        OR: [getTenantOwnedWhere({ ...d, solution }), getManagedBackingWhere({ tenant: d.tenant, solution })]
      },
      include
    });
  }

  async updateProviderAuthCredentialsInternal(d: UpdateProviderAuthCredentialsParams) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.providerAuthCredentials);
    checkDeletedEdit(d.providerAuthCredentials, 'update');

    let managedCredentials = await this.getManagedProviderAuthCredentialsContext({
      tenant: d.tenant,
      providerAuthCredentials: d.providerAuthCredentials
    });

    if (d.input.scopes && managedCredentials) {
      let allowedScopes = new Set(
        normalizeManagedOAuthScopeIds(managedCredentials.oauthScopes)
      );
      let invalidScopes = d.input.scopes.filter(scope => !allowedScopes.has(scope));
      if (invalidScopes.length > 0) {
        throw new ServiceError(
          badRequestError({
            message: 'Scopes must be a subset of the managed credentials scopes',
            code: 'managed_credentials_scope_mismatch'
          })
        );
      }
    }

    if (managedCredentials && (d.input.clientId || d.input.clientSecret)) {
      throw new ServiceError(
        badRequestError({
          message: 'Client ID and secret cannot be updated for managed credentials',
          code: 'managed_credentials_readonly'
        })
      );
    }

    if (d.input.scopes || d.input.clientId || d.input.clientSecret) {
      let backend = await getBackend({
        entity: d.providerAuthCredentials
      });

      await backend.auth.updateProviderAuthCredentials({
        tenant: d.tenant,
        backing: d.providerAuthCredentials,
        input: {
          type: 'oauth',
          scopes: d.input.scopes,
          clientId: d.input.clientId,
          clientSecret: d.input.clientSecret
        }
      });
    }

    return withTransaction(async db => {
      let creds = await db.providerAuthCredentials.update({
        where: {
          oid: d.providerAuthCredentials.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid
        },
        data: {
          name: d.input.name ?? d.providerAuthCredentials.name,
          description: d.input.description ?? d.providerAuthCredentials.description,
          metadata: d.input.metadata ?? d.providerAuthCredentials.metadata,
          privateMetadata:
            d.input.privateMetadata ?? d.providerAuthCredentials.privateMetadata,
          scopes: d.input.scopes ?? d.providerAuthCredentials.scopes,
          needsScopeSync: d.input.scopes ? false : d.providerAuthCredentials.needsScopeSync
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsUpdatedQueue.add({ providerAuthCredentialsId: creds.id })
      );

      return creds;
    });
  }

  async syncProviderAuthCredentialsScopes(
    d: MetorialFacing<SyncProviderAuthCredentialsScopesParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.syncProviderAuthCredentialsScopesInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async syncProviderAuthCredentialsScopesInternal(
    d: { tenant: Tenant } & SyncProviderAuthCredentialsScopesParams
  ) {
    return withTransaction(
      async db => {
        let scopes = (
          await (
            await getBackend({
              entity: {
                backendOid: d.providerAuthCredentials.backendOid
              }
            })
          ).auth.getProviderAuthCredentialsScopes({
            tenant: d.tenant,
            providerAuthCredentials: d.providerAuthCredentials
          })
        ).scopes;

        return await db.providerAuthCredentials.update({
          where: { oid: d.providerAuthCredentials.oid },
          data: {
            scopes,
            needsScopeSync: false
          },
          include
        });
      },
      { ifExists: true }
    );
  }

  async archiveProviderAuthCredentialsInternal(d: ArchiveProviderAuthCredentialsParams) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.providerAuthCredentials);
    checkDeletedEdit(d.providerAuthCredentials, 'archive');

    if (d.providerAuthCredentials.origin !== 'tenant_created') {
      throw new ServiceError(
        badRequestError({
          message: 'Managed credentials cannot be deleted through tenant APIs',
          code: 'managed_credentials_readonly'
        })
      );
    }

    await this.assertNoActiveIntegrationProviderLink(d);
    await assertNoActiveIntegrationInstanceProviderAuthCredentialsLink({
      tenant: d.tenant,
      environment: d.environment,
      solution,
      authCredentialsOid: d.providerAuthCredentials.oid,
      resourceId: d.providerAuthCredentials.id
    });

    return withTransaction(async db => {
      let creds = await db.providerAuthCredentials.update({
        where: {
          oid: d.providerAuthCredentials.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          isDefault: false
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsArchivedQueue.add({
          providerAuthCredentialsId: creds.id
        })
      );

      return creds;
    });
  }

  async createProviderAuthCredentialsInternal(d: CreateParams) {
    return this.createProviderAuthCredentialsInner(d);
  }

  async ensureDefaultProviderAuthCredentials(
    d: MetorialFacing<EnsureDefaultProviderAuthCredentialsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.ensureDefaultProviderAuthCredentialsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async ensureDefaultProviderAuthCredentialsInternal(
    d: { tenant: Tenant; environment: Environment } & EnsureDefaultProviderAuthCredentialsParams
  ) {
    let solution = await getMetorialSolution();
    let getExisting = () =>
      db.providerAuthCredentials.findFirst({
        where: {
          ...getTenantOwnedWhere({ ...d, solution }),
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

  async getProviderAuthCredentialsForBackendUse(
    d: MetorialFacing<GetProviderAuthCredentialsForBackendUseParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthCredentialsForBackendUseInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async getProviderAuthCredentialsForBackendUseInternal(
    d: { tenant: Tenant } & GetProviderAuthCredentialsForBackendUseParams
  ) {
    let managedCredentials = await this.getManagedProviderAuthCredentialsContext(d);
    if (!managedCredentials) {
      return d.providerAuthCredentials;
    }

    return ensureManagedProviderAuthCredentialsBacking({
      tenant: d.tenant,
      managedCredentials,
      providerAuthMethod: d.providerAuthMethod
    });
  }

  private async createProviderAuthCredentialsInner(d: CreateParams & { isDefault?: boolean }) {
    let solution = await getMetorialSolution();
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
          privateMetadata: d.input.privateMetadata,

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.isDefault,

          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid
        },
        include
      });

      if (providerAuthCredentials.isDefault) {
        await db.providerAuthCredentials.updateMany({
          where: {
            ...getTenantOwnedWhere({ ...d, solution }),
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

      return await this.syncProviderAuthCredentialsScopesInternal({
        tenant: d.tenant,
        providerAuthCredentials
      });
    });
  }

  private async getManagedProviderAuthCredentialsContext(d: {
    tenant: Tenant;
    providerAuthCredentials: ProviderAuthCredentials;
  }) {
    let solution = await getMetorialSolution();
    if (
      d.providerAuthCredentials.origin === 'managed_public' &&
      d.providerAuthCredentials.managedCredentialsOid
    ) {
      return await db.managedProviderAuthCredentials.findFirstOrThrow({
        where: {
          oid: d.providerAuthCredentials.managedCredentialsOid,
          solutionOid: solution.oid
        },
        include: managedCredentialsInclude
      });
    }

    if (d.providerAuthCredentials.origin !== 'managed_backing') {
      return null;
    }

    let managedBacking = await db.managedProviderAuthCredentialsBacking.findFirstOrThrow({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        providerAuthCredentialsOid: d.providerAuthCredentials.oid
      },
      include: {
        managedCredentials: {
          include: managedCredentialsInclude
        }
      }
    });

    return managedBacking.managedCredentials;
  }

  private async assertNoActiveIntegrationProviderLink(d: {
    tenant: Tenant;
    environment: Environment;
    providerAuthCredentials: ProviderAuthCredentials;
  }) {
    let solution = await getMetorialSolution();
    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: 'active',
        integration: {
          status: 'active'
        },
        currentVersion: {
          authCredentialsOid: d.providerAuthCredentials.oid
        }
      },
      select: {
        id: true,
        integration: {
          select: {
            id: true
          }
        }
      }
    });
    if (!integrationProvider) return;

    throw new ServiceError(
      badRequestError({
        message:
          'Provider auth credentials are linked to an active integration provider and cannot be archived directly.',
        code: 'provider_auth_credentials_integration_provider_archive_not_allowed',
        data: {
          id: d.providerAuthCredentials.id,
          integrationProviderId: integrationProvider.id,
          integrationId: integrationProvider.integration.id
        }
      })
    );
  }

  private async getProviderAuthCredentialsForTenantRead(d: {
    tenant: Tenant;
    providerAuthCredentials: ProviderAuthCredentialsRecord;
  }) {
    if (d.providerAuthCredentials.origin === 'managed_backing') {
      let backingCredentials = await ensureManagedProviderAuthCredentialsBacking({
        tenant: d.tenant,
        managedCredentials: d.providerAuthCredentials.managedCredentialsBacking!
          .managedCredentials as ManagedProviderAuthCredentialsBackingSource,
        providerAuthMethod: {
          globalOid:
            d.providerAuthCredentials.managedCredentialsBacking!.managedCredentials
              .providerAuthMethodGlobalOid ??
            d.providerAuthCredentials.managedCredentialsBacking!.managedCredentials
              .initialProviderAuthMethod.globalOid
        }
      });

      return await db.providerAuthCredentials.findUniqueOrThrow({
        where: {
          oid: backingCredentials.oid
        },
        include
      });
    }

    return d.providerAuthCredentials;
  }
}

export let providerAuthCredentialsService = Service.create(
  'providerAuthCredentials',
  () => new providerAuthCredentialsServiceImpl()
).build();
