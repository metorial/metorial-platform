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
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
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

class providerConfigVaultServiceImpl {
  async listProviderConfigVaults(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: ProviderConfigVaultStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);

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
              solutionOid: d.solution.oid,
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

  async getProviderConfigVaultById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerConfigVaultId: string;
    allowDeleted?: boolean;
  }) {
    let providerConfigVault = await db.providerConfigVault.findFirst({
      where: {
        id: d.providerConfigVaultId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!providerConfigVault)
      throw new ServiceError(notFoundError('provider.config_vault', d.providerConfigVaultId));

    return providerConfigVault;
  }

  async createProviderConfigVault(d: {
    tenant: Tenant;
    solution: Solution;
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
      config: {
        type: 'inline';
        data: Record<string, any>;
      };
    };
  }) {
    checkTenant(d, d.providerDeployment);

    checkDeletedRelation(d.provider);
    checkDeletedRelation(d.providerDeployment);

    return await withTransaction(async db => {
      let config = await providerConfigService.createProviderConfig({
        tenant: d.tenant,
        solution: d.solution,
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
          tenantOid: d.tenant.oid,
          configOid: config.oid,
          providerOid: d.provider.oid,
          solutionOid: d.solution.oid,
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

  async updateProviderConfigVault(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerConfigVault: ProviderConfigVault;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerConfigVault);
    checkDeletedEdit(d.providerConfigVault, 'update');

    return withTransaction(async db => {
      let vault = await db.providerConfigVault.update({
        where: {
          oid: d.providerConfigVault.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.providerConfigVault.name,
          description: d.input.description ?? d.providerConfigVault.description,
          metadata: d.input.metadata ?? d.providerConfigVault.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigVaultUpdatedQueue.add({ providerConfigVaultId: vault.id })
      );

      return vault;
    });
  }

  async archiveProviderConfigVault(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerConfigVault: ProviderConfigVault;
  }) {
    checkTenant(d, d.providerConfigVault);
    checkDeletedEdit(d.providerConfigVault, 'archive');

    return withTransaction(async db => {
      let archivedAt = new Date();
      let vault = await db.providerConfigVault.update({
        where: {
          oid: d.providerConfigVault.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
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
