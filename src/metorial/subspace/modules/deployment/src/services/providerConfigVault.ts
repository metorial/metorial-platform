import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderConfigVault,
  type ProviderConfigVaultStatus,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
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
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import {
  providerConfigVaultArchivedQueue,
  providerConfigVaultCreatedQueue,
  providerConfigVaultUpdatedQueue
} from '../queues/lifecycle/providerConfigVault';
import { providerConfigService } from './providerConfig';

let include = {
  provider: true,
  deployment: true
};

export type CreateProviderConfigVaultParams = {
  tenant: Tenant;
  environment: Environment;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerDeployment?: ProviderDeployment & {
    provider: Provider;
    providerVariant: ProviderVariant;
    currentVersion:
      | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
      | null;
  };
  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    config: {
      type: 'inline';
      data: Record<string, any>;
    };
  };
};

export type UpdateProviderConfigVaultParams = {
  tenant: Tenant;
  environment: Environment;
  providerConfigVault: ProviderConfigVault;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  };
};

export type ArchiveProviderConfigVaultParams = {
  tenant: Tenant;
  environment: Environment;
  providerConfigVault: ProviderConfigVault;
};

type ListProviderConfigVaultsParams = {
  search?: string;

  status?: ProviderConfigVaultStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  providerIds?: string[];
  providerDeploymentIds?: string[];
  providerConfigIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetProviderConfigVaultByIdParams = {
  providerConfigVaultId: string;
  allowDeleted?: boolean;
};

type GetManyProviderConfigVaultsByIdsParams = {
  ids: string[];
  allowDeleted?: boolean;
};

class providerConfigVaultServiceImpl {
  async createProviderConfigVault(d: MetorialFacing<CreateProviderConfigVaultParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.config_vault.created:before', eventBase);

    let configVault = await this.createProviderConfigVaultInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.config_vault.created:after', { ...eventBase, configVault });

    return configVault;
  }

  async updateProviderConfigVault(d: MetorialFacing<UpdateProviderConfigVaultParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.config_vault.updated:before', eventBase);

    let configVault = await this.updateProviderConfigVaultInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.config_vault.updated:after', { ...eventBase, configVault });

    return configVault;
  }

  async archiveProviderConfigVault(d: MetorialFacing<ArchiveProviderConfigVaultParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.config_vault.deleted:before', eventBase);

    let configVault = await this.archiveProviderConfigVaultInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.config_vault.deleted:after', { ...eventBase, configVault });

    return configVault;
  }

  async listProviderConfigVaults(d: MetorialFacing<ListProviderConfigVaultsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderConfigVaultsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderConfigVaultsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderConfigVaultsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.providerConfigVault.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerConfigVault.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                configs ? { configOid: configs.in } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderConfigVaultById(d: MetorialFacing<GetProviderConfigVaultByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderConfigVaultByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderConfigVaultByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderConfigVaultByIdParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providerConfigVault = await db.providerConfigVault.findFirst({
      where: {
        id: d.providerConfigVaultId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!providerConfigVault)
      throw new ServiceError(notFoundError('provider.config_vault', d.providerConfigVaultId));

    return providerConfigVault;
  }

  async getManyProviderConfigVaultsByIds(
    d: MetorialFacing<GetManyProviderConfigVaultsByIdsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getManyProviderConfigVaultsByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getManyProviderConfigVaultsByIdsInternal(
    d: { tenant: Tenant; environment: Environment } & GetManyProviderConfigVaultsByIdsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    return await db.providerConfigVault.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
  }

  async createProviderConfigVaultInternal(d: CreateProviderConfigVaultParams) {
    checkTenant(d, d.providerDeployment);

    checkDeletedRelation(d.provider);
    checkDeletedRelation(d.providerDeployment);

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    return await withTransaction(async db => {
      let config = await providerConfigService.createProviderConfigInternal({
        tenant: d.tenant,
        environment: d.environment,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        input: {
          name: `Vault Config for ${d.input.name}`,
          isEphemeral: true,
          isForVault: true,
          isDefault: false,
          config: d.input.config
        }
      });

      let vault = await db.providerConfigVault.create({
        data: {
          ...getId('providerConfigVault'),
          status: 'active',
          name: d.input.name,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          tenantOid: d.tenant.oid,
          configOid: config.oid,
          providerOid: d.provider.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          deploymentOid: d.providerDeployment?.oid
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigVaultCreatedQueue.add({ providerConfigVaultId: vault.id })
      );

      return vault;
    });
  }

  async updateProviderConfigVaultInternal(d: UpdateProviderConfigVaultParams) {
    checkTenant(d, d.providerConfigVault);
    checkDeletedEdit(d.providerConfigVault, 'update');

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    return withTransaction(async db => {
      let vault = await db.providerConfigVault.update({
        where: {
          oid: d.providerConfigVault.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.providerConfigVault.name,
          description: d.input.description ?? d.providerConfigVault.description,
          metadata: d.input.metadata ?? d.providerConfigVault.metadata,
          privateMetadata: d.input.privateMetadata ?? d.providerConfigVault.privateMetadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigVaultUpdatedQueue.add({ providerConfigVaultId: vault.id })
      );

      return vault;
    });
  }

  async archiveProviderConfigVaultInternal(d: ArchiveProviderConfigVaultParams) {
    checkTenant(d, d.providerConfigVault);
    checkDeletedEdit(d.providerConfigVault, 'archive');

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    return withTransaction(async db => {
      let archivedAt = new Date();
      let vault = await db.providerConfigVault.update({
        where: {
          oid: d.providerConfigVault.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigVaultArchivedQueue.add({
          providerConfigVaultId: vault.id
        })
      );

      return vault;
    });
  }
}

export let providerConfigVaultService = Service.create(
  'providerConfigVault',
  () => new providerConfigVaultServiceImpl()
).build();
