import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Integration,
  type IntegrationStatus,
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
  resolveIntegrationProviders,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { createIntegrationVersion } from '../lib/versions';
import {
  integrationArchivedQueue,
  integrationCreatedQueue,
  integrationUpdatedQueue
} from '../queues/lifecycle/integration';

import { integrationVersionInclude } from './integrationVersion';

export let integrationProviderVersionInclude = {
  deployment: true,
  authMethod: { include: { specification: { omit: { value: true } } } },
  authCredentials: true,
  config: true
};

export let integrationInclude = {
  currentVersion: {
    include: integrationVersionInclude
  },
  providers: {
    where: { status: 'active' as const },
    include: {
      provider: true,
      currentVersion: {
        include: integrationProviderVersionInclude
      }
    }
  }
};

let getSlug = (input: { name: string }) =>
  `${slugify(input.name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

class integrationServiceImpl {
  async listIntegrations(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: IntegrationStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    integrationProviderIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let providers = await resolveProviders(d, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(d, d.integrationProviderIds);
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.integration.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers
                  ? { providers: { some: { providerOid: providers.in } } }
                  : undefined!,
                integrationProviders
                  ? { providers: { some: { oid: integrationProviders.in } } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationInclude
          })
      )
    );
  }

  async getIntegrationById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationId: string;
    allowDeleted?: boolean;
  }) {
    let integration = await db.integration.findFirst({
      where: {
        id: d.integrationId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: integrationInclude
    });
    if (!integration) throw new ServiceError(notFoundError('integration', d.integrationId));

    return integration;
  }

  async createIntegration(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
    };
  }) {
    return await withTransaction(async db => {
      let integration = await db.integration.create({
        data: {
          ...getId('integration'),
          status: 'active',
          slug: getSlug(d.input),
          name: d.input.name.trim(),
          description: d.input.description?.trim(),
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          currentVersionIndex: 0,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      });

      await createIntegrationVersion({ integrationOid: integration.oid });

      let res = await db.integration.findUniqueOrThrow({
        where: { oid: integration.oid },
        include: integrationInclude
      });

      await addAfterTransactionHook(async () =>
        integrationCreatedQueue.add({ integrationId: res.id })
      );

      return res;
    });
  }

  async updateIntegration(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
    };
  }) {
    checkTenant(d, d.integration);
    checkDeletedEdit(d.integration, 'update');

    return await withTransaction(async db => {
      let integration = await db.integration.update({
        where: {
          oid: d.integration.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name?.trim() ?? d.integration.name,
          description:
            d.input.description === undefined
              ? d.integration.description
              : d.input.description?.trim() || null,
          metadata: d.input.metadata === undefined ? d.integration.metadata : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.integration.privateMetadata
              : d.input.privateMetadata
        },
        include: integrationInclude
      });

      await addAfterTransactionHook(async () =>
        integrationUpdatedQueue.add({ integrationId: integration.id })
      );

      return integration;
    });
  }

  async archiveIntegration(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
  }) {
    checkTenant(d, d.integration);
    checkDeletedEdit(d.integration, 'archive');

    return await withTransaction(async db => {
      let integration = await db.integration.update({
        where: {
          oid: d.integration.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include: integrationInclude
      });

      await addAfterTransactionHook(async () =>
        integrationArchivedQueue.add({ integrationId: integration.id })
      );

      return integration;
    });
  }

  async deleteIntegration(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
  }) {
    return await this.archiveIntegration(d);
  }
}

export let integrationService = Service.create(
  'integration',
  () => new integrationServiceImpl()
).build();
