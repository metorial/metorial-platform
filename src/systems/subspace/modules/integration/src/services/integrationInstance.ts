import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Integration,
  type IntegrationInstance,
  type IntegrationInstanceStatus,
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
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  integrationInstanceArchivedQueue,
  integrationInstanceCreatedQueue,
  integrationInstanceUpdatedQueue
} from '../queues/lifecycle/integrationInstance';
import { integrationProviderVersionInclude } from './integration';

export let integrationInstanceProviderVersionInclude = {
  integrationProviderVersion: {
    include: integrationProviderVersionInclude
  },
  config: { include: { provider: true } },
  authConfig: { include: { provider: true } }
};

export let integrationInstanceProviderInclude = {
  integration: true,
  integrationInstance: true,
  integrationProvider: {
    include: {
      integration: true,
      provider: true,
      currentVersion: {
        include: integrationProviderVersionInclude
      }
    }
  },
  currentVersion: {
    include: integrationInstanceProviderVersionInclude
  }
};

export let integrationInstanceInclude = {
  integration: true,
  integrationInstanceProviders: {
    where: { status: 'active' as const, isParentDeleted: false },
    include: integrationInstanceProviderInclude
  }
};

class integrationInstanceServiceImpl {
  async listIntegrationInstances(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: IntegrationInstanceStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    integrationIds?: string[];
    providerIds?: string[];
    integrationProviderIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let integrations = await resolveIntegrations(d, d.integrationIds);
    let providers = await resolveProviders(d, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(d, d.integrationProviderIds);
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.integrationInstance.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationInstance.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                integrations ? { integrationOid: integrations.in } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers
                  ? {
                      integrationInstanceProviders: {
                        some: { integrationProvider: { providerOid: providers.in } }
                      }
                    }
                  : undefined!,
                integrationProviders
                  ? {
                      integrationInstanceProviders: {
                        some: { integrationProviderOid: integrationProviders.in }
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationInstanceInclude
          })
      )
    );
  }

  async getIntegrationInstanceById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceId: string;
    allowDeleted?: boolean;
  }) {
    let integrationInstance = await db.integrationInstance.findFirst({
      where: {
        id: d.integrationInstanceId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: integrationInstanceInclude
    });
    if (!integrationInstance)
      throw new ServiceError(notFoundError('integration.instance', d.integrationInstanceId));

    return integrationInstance;
  }

  async createIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.integration);
    checkDeletedRelation(d.integration);

    return await withTransaction(async db => {
      let integrationInstance = await db.integrationInstance.create({
        data: {
          ...getId('integrationInstance'),
          status: 'draft',
          name: d.input.name.trim(),
          description: d.input.description?.trim(),
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          integrationOid: d.integration.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: integrationInstanceInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceCreatedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

      return integrationInstance;
    });
  }

  async updateIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
    };
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedEdit(d.integrationInstance, 'update');

    return await withTransaction(async db => {
      let integrationInstance = await db.integrationInstance.update({
        where: {
          oid: d.integrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.integrationInstance.name,
          description:
            d.input.description === undefined
              ? d.integrationInstance.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined ? d.integrationInstance.metadata : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.integrationInstance.privateMetadata
              : d.input.privateMetadata
        },
        include: integrationInstanceInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceUpdatedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

      return integrationInstance;
    });
  }

  async archiveIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
  }) {
    checkTenant(d, d.integrationInstance);
    checkDeletedEdit(d.integrationInstance, 'archive');

    return await withTransaction(async db => {
      let integrationInstance = await db.integrationInstance.update({
        where: {
          oid: d.integrationInstance.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include: integrationInstanceInclude
      });

      await addAfterTransactionHook(async () =>
        integrationInstanceArchivedQueue.add({ integrationInstanceId: integrationInstance.id })
      );

      return integrationInstance;
    });
  }

  async deleteIntegrationInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstance: IntegrationInstance;
  }) {
    return await this.archiveIntegrationInstance(d);
  }
}

export let integrationInstanceService = Service.create(
  'integrationInstance',
  () => new integrationInstanceServiceImpl()
).build();
