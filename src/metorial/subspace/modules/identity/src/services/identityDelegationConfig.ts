import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type IdentityDelegationConfig,
  type IdentityDelegationConfigStatus,
  type IdentityDelegationConfigSubDelegationBehavior,
  type IdentityDelegationConfigVersion,
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
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { env } from '../env';
import {
  identityDelegationConfigCreatedQueue,
  identityDelegationConfigDeletedQueue,
  identityDelegationConfigUpdatedQueue
} from '../queues/lifecycle/identityDelegationConfig';

let include = {
  currentVersion: true
};

let ensureDefaultLock = createLock({
  redisUrl: env.service.REDIS_URL,
  name: 'sub/idn/sidx/identityDelegationConfig/default'
});

export type ListIdentityDelegationConfigsParams = {
  tenant: Tenant;
  environment: Environment;

  search?: string;

  status?: IdentityDelegationConfigStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIdentityDelegationConfigByIdParams = {
  tenant: Tenant;
  environment: Environment;
  identityDelegationConfigId: string;
  allowDeleted?: boolean;
};

export type CreateIdentityDelegationConfigParams = {
  tenant: Tenant;
  environment: Environment;

  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;

    subDelegationDepth?: number;
    subDelegationBehavior: IdentityDelegationConfigSubDelegationBehavior;
  };
};

export type EnsureDefaultIdentityDelegationConfigParams = {
  tenant: Tenant;
  environment: Environment;
};

export type UpdateIdentityDelegationConfigParams = {
  tenant: Tenant;
  environment: Environment;
  identityDelegationConfig: IdentityDelegationConfig & {
    currentVersion: IdentityDelegationConfigVersion | null;
  };

  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;

    subDelegationDepth?: number;
    subDelegationBehavior?: IdentityDelegationConfigSubDelegationBehavior;
  };
};

export type ArchiveIdentityDelegationConfigParams = {
  tenant: Tenant;
  environment: Environment;
  identityDelegationConfig: IdentityDelegationConfig;
};

class identityDelegationConfigServiceImpl {
  async listIdentityDelegationConfigs(d: MetorialFacing<ListIdentityDelegationConfigsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listIdentityDelegationConfigsInternal({ ...rest, tenant, environment });
  }

  async listIdentityDelegationConfigsInternal(d: ListIdentityDelegationConfigsParams) {
    let solution = await getMetorialSolution();

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.identityDelegationConfig.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityDelegationConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityDelegationConfigById(
    d: MetorialFacing<GetIdentityDelegationConfigByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getIdentityDelegationConfigByIdInternal({ ...rest, tenant, environment });
  }

  async getIdentityDelegationConfigByIdInternal(d: GetIdentityDelegationConfigByIdParams) {
    if (d.identityDelegationConfigId === 'default') {
      return await this.ensureDefaultIdentityDelegationConfig(d);
    }

    let solution = await getMetorialSolution();

    let identityDelegationConfig = await db.identityDelegationConfig.findFirst({
      where: {
        id: d.identityDelegationConfigId,

        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!identityDelegationConfig)
      throw new ServiceError(
        notFoundError('identity.delegation_config', d.identityDelegationConfigId)
      );

    return identityDelegationConfig;
  }

  async createIdentityDelegationConfig(d: MetorialFacing<CreateIdentityDelegationConfigParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.createIdentityDelegationConfigInternal({ ...rest, tenant, environment });
  }

  async createIdentityDelegationConfigInternal(d: CreateIdentityDelegationConfigParams) {
    return withTransaction(async (db: any) => {
      return this._createIdentityDelegationConfig({
        ...d,
        db
      });
    });
  }

  async ensureDefaultIdentityDelegationConfig(d: EnsureDefaultIdentityDelegationConfigParams) {
    let solution = await getMetorialSolution();

    let defaultFilter = {
      tenantOid: d.tenant.oid,
      solutionOid: solution.oid,
      environmentOid: d.environment.oid,
      isDefault: true,
      status: 'active' as const
    };

    let existingDefault = await db.identityDelegationConfig.findFirst({
      where: defaultFilter,
      include
    });
    if (existingDefault) return existingDefault;

    return await ensureDefaultLock.usingLock([d.tenant.id, d.environment.id], async () => {
      let existingDefault = await db.identityDelegationConfig.findFirst({
        where: defaultFilter,
        include
      });
      if (existingDefault) return existingDefault;

      // We are not using withTransaction here since we don't want to this
      // to be rolled back if a parent transaction rolls back. This is
      // a global default that should never be dependent on any other transaction.
      return await db.$transaction(async (db: any) => {
        return await this._createIdentityDelegationConfig({
          tenant: d.tenant,
          environment: d.environment,
          input: {
            name: 'Default Delegation Config',
            description: 'Automatically created by Metorial',
            subDelegationBehavior: 'deny'
          },
          _isDefault: true,
          db
        });
      });
    });
  }

  async updateIdentityDelegationConfig(d: MetorialFacing<UpdateIdentityDelegationConfigParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.updateIdentityDelegationConfigInternal({ ...rest, tenant, environment });
  }

  async updateIdentityDelegationConfigInternal(d: UpdateIdentityDelegationConfigParams) {
    checkTenant(d, d.identityDelegationConfig);
    checkDeletedEdit(d.identityDelegationConfig, 'update');

    return withTransaction(async db => {
      let version = await db.identityDelegationConfigVersion.create({
        data: {
          ...getId('identityDelegationConfigVersion'),

          delegationConfigOid: d.identityDelegationConfig.oid,

          ...this.normalizeSubDelegation({
            current: d.identityDelegationConfig.currentVersion ?? undefined,
            input: {
              subDelegationBehavior: d.input.subDelegationBehavior,
              subDelegationDepth: d.input.subDelegationDepth
            }
          })
        }
      });

      let identityDelegationConfig = await db.identityDelegationConfig.update({
        where: {
          oid: d.identityDelegationConfig.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.identityDelegationConfig.name,
          description: d.input.description ?? d.identityDelegationConfig.description,
          metadata: d.input.metadata ?? d.identityDelegationConfig.metadata,
          currentVersionOid: version.oid
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityDelegationConfigUpdatedQueue.add({
          identityDelegationConfigId: identityDelegationConfig.id
        })
      );

      return identityDelegationConfig;
    });
  }

  async archiveIdentityDelegationConfig(d: MetorialFacing<ArchiveIdentityDelegationConfigParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.archiveIdentityDelegationConfigInternal({ ...rest, tenant, environment });
  }

  async archiveIdentityDelegationConfigInternal(d: ArchiveIdentityDelegationConfigParams) {
    checkTenant(d, d.identityDelegationConfig);
    checkDeletedEdit(d.identityDelegationConfig, 'archive');

    return withTransaction(async db => {
      let identityDelegationConfig = await db.identityDelegationConfig.update({
        where: {
          oid: d.identityDelegationConfig.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityDelegationConfigDeletedQueue.add({
          identityDelegationConfigId: identityDelegationConfig.id
        })
      );

      return identityDelegationConfig;
    });
  }

  private async _createIdentityDelegationConfig(d: {
    tenant: Tenant;
    environment: Environment;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;

      subDelegationDepth?: number;
      subDelegationBehavior: IdentityDelegationConfigSubDelegationBehavior;
    };

    _isDefault?: boolean;

    db: typeof db;
  }) {
    let solution = await getMetorialSolution();

    let identityDelegationConfig = await db.identityDelegationConfig.create({
      data: {
        ...getId('identityDelegationConfig'),

        status: 'active',

        isDefault: d._isDefault || false,

        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        metadata: d.input.metadata,

        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid
      }
    });

    let currentVersion = await db.identityDelegationConfigVersion.create({
      data: {
        ...getId('identityDelegationConfigVersion'),

        delegationConfigOid: identityDelegationConfig.oid,

        ...this.normalizeSubDelegation({
          input: {
            subDelegationBehavior: d.input.subDelegationBehavior,
            subDelegationDepth: d.input.subDelegationDepth
          }
        })
      }
    });

    await db.identityDelegationConfig.updateMany({
      where: { oid: identityDelegationConfig.oid },
      data: { currentVersionOid: currentVersion.oid }
    });

    await addAfterTransactionHook(async () =>
      identityDelegationConfigCreatedQueue.add({
        identityDelegationConfigId: identityDelegationConfig.id
      })
    );

    return await db.identityDelegationConfig.findFirstOrThrow({
      where: { oid: identityDelegationConfig.oid },
      include
    });
  }

  private normalizeSubDelegation(d: {
    current?: IdentityDelegationConfigVersion;
    input: {
      subDelegationBehavior?: IdentityDelegationConfigSubDelegationBehavior;
      subDelegationDepth?: number;
    };
  }) {
    let subDelegationBehavior =
      d.input.subDelegationBehavior ?? d.current?.subDelegationBehavior ?? 'deny';

    let subDelegationDepth =
      subDelegationBehavior === 'deny'
        ? 0
        : Math.max(1, d.input.subDelegationDepth ?? d.current?.subDelegationDepth ?? 1);

    return { subDelegationBehavior, subDelegationDepth };
  }
}

export let identityDelegationConfigService = Service.create(
  'identityDelegationConfig',
  () => new identityDelegationConfigServiceImpl()
).build();
