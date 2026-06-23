import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
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
import { integrationProviderVersionInclude } from '../lib/integrationIncludes';
import { createIntegrationVersion } from '../lib/versions';
import {
  integrationArchivedQueue,
  integrationCreatedQueue,
  integrationUpdatedQueue
} from '../queues/lifecycle/integration';

import { integrationVersionInclude } from './integrationVersion';

export { integrationProviderVersionInclude };

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
  },
  providerTemplateBacking: true,
  magicMcpServerBacking: true
};

export let magicMcpBackingIntegrationInclude = {
  currentVersion: {
    include: integrationVersionInclude
  }
};

let getSlug = (input: { name: string }) =>
  `${slugify(input.name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

export let getIntegrationToolFilterCapabilities = (
  integration: Pick<Integration, 'canAttachCustomToolFilters' | 'canOverrideToolFilters'>
) => ({
  canAttachCustomToolFilters:
    integration.canOverrideToolFilters || integration.canAttachCustomToolFilters,
  canOverrideToolFilters: integration.canOverrideToolFilters
});

type IntegrationWriteInput = {
  name: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
  canAttachCustomToolFilters?: boolean;
  canAttachCustomProviderConfig?: boolean;
  canOverrideToolFilters?: boolean;
  useIntegrationNameForSessionProviderNameTemplatesOverride?: boolean | null;
};

class integrationServiceImpl {
  private integrationCreateData(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    id: ReturnType<typeof getId>;
    slug: string;
    input: IntegrationWriteInput;
    isMagicMcpBacking?: boolean;
  }) {
    let canOverrideToolFilters = d.input.canOverrideToolFilters ?? false;

    return {
      ...d.id,
      status: 'active' as const,
      isMagicMcpBacking: !!d.isMagicMcpBacking,
      slug: slugify(d.slug),
      name: d.input.name.trim(),
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata,
      canAttachCustomToolFilters:
        canOverrideToolFilters || (d.input.canAttachCustomToolFilters ?? true),
      canAttachCustomProviderConfig: d.input.canAttachCustomProviderConfig ?? false,
      canOverrideToolFilters,
      useIntegrationNameForSessionProviderNameTemplatesOverride:
        d.input.useIntegrationNameForSessionProviderNameTemplatesOverride ?? null,
      currentVersionIndex: 0,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid
    };
  }

  private integrationUpdateData(
    input: IntegrationWriteInput & { isMagicMcpBacking?: boolean }
  ) {
    return {
      status: 'active' as const,
      archivedAt: null,
      isMagicMcpBacking: input.isMagicMcpBacking,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      metadata: input.metadata,
      privateMetadata: input.privateMetadata,
      canAttachCustomToolFilters: input.canOverrideToolFilters
        ? true
        : input.canAttachCustomToolFilters,
      canAttachCustomProviderConfig: input.canAttachCustomProviderConfig,
      canOverrideToolFilters: input.canOverrideToolFilters,
      useIntegrationNameForSessionProviderNameTemplatesOverride:
        input.useIntegrationNameForSessionProviderNameTemplatesOverride
    };
  }

  async listIntegrations(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;
    includeMagicMcpBackings?: boolean;

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
              OR: d.includeMagicMcpBackings
                ? undefined
                : [{ isMagicMcpBacking: false }, { providerTemplateBacking: { isNot: null } }],

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
      canAttachCustomToolFilters?: boolean;
      canAttachCustomProviderConfig?: boolean;
      canOverrideToolFilters?: boolean;
      useIntegrationNameForSessionProviderNameTemplatesOverride?: boolean | null;
    };
  }) {
    return await withTransaction(async db => {
      let newId = getId('integration');
      let integration = await db.integration.create({
        data: this.integrationCreateData({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          id: newId,
          slug: getSlug(d.input),
          input: d.input
        })
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

  async upsertMagicMcpIntegration(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration?: Integration | null;
    input: {
      slug: string;
      name: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      canAttachCustomToolFilters?: boolean;
      canAttachCustomProviderConfig?: boolean;
      canOverrideToolFilters?: boolean;
      useIntegrationNameForSessionProviderNameTemplatesOverride?: boolean | null;
    };
  }) {
    return await withTransaction(async db => {
      if (d.integration) {
        checkTenant(d, d.integration);

        let integration = await db.integration.update({
          where: {
            oid: d.integration.oid,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid
          },
          data: this.integrationUpdateData({ ...d.input, isMagicMcpBacking: true }),
          include: magicMcpBackingIntegrationInclude
        });

        await addAfterTransactionHook(async () =>
          integrationUpdatedQueue.add({ integrationId: integration.id })
        );

        return integration;
      }

      let newId = getId('integration');
      let integration = await db.integration.upsert({
        where: { slug: d.input.slug },
        create: this.integrationCreateData({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          id: newId,
          slug: d.input.slug,
          input: d.input,
          isMagicMcpBacking: true
        }),
        update: this.integrationUpdateData({ ...d.input, isMagicMcpBacking: true }),
        include: magicMcpBackingIntegrationInclude
      });
      let isNew = integration.id === newId.id;

      if (isNew || !integration.currentVersionOid) {
        await createIntegrationVersion({ integrationOid: integration.oid });
        integration = await db.integration.findUniqueOrThrow({
          where: { oid: integration.oid },
          include: magicMcpBackingIntegrationInclude
        });
      }

      await addAfterTransactionHook(async () => {
        if (isNew) await integrationCreatedQueue.add({ integrationId: integration.id });
        else await integrationUpdatedQueue.add({ integrationId: integration.id });
      });

      return integration;
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
      canAttachCustomToolFilters?: boolean;
      canAttachCustomProviderConfig?: boolean;
      canOverrideToolFilters?: boolean;
      useIntegrationNameForSessionProviderNameTemplatesOverride?: boolean | null;
    };
  }) {
    checkTenant(d, d.integration);
    checkDeletedEdit(d.integration, 'update');

    let canOverrideToolFilters =
      d.input.canOverrideToolFilters ?? d.integration.canOverrideToolFilters;
    let canAttachCustomToolFilters = canOverrideToolFilters
      ? true
      : (d.input.canAttachCustomToolFilters ?? d.integration.canAttachCustomToolFilters);

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
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          canAttachCustomToolFilters,
          canAttachCustomProviderConfig: d.input.canAttachCustomProviderConfig,
          canOverrideToolFilters,
          useIntegrationNameForSessionProviderNameTemplatesOverride:
            d.input.useIntegrationNameForSessionProviderNameTemplatesOverride
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
    _canModifyMagicMcpBacking?: boolean;
  }) {
    checkTenant(d, d.integration);
    checkDeletedEdit(d.integration, 'archive');
    if (d.integration.isMagicMcpBacking && !d._canModifyMagicMcpBacking) {
      throw new ServiceError(
        badRequestError({
          message: 'Magic MCP backed integrations cannot be deleted directly.',
          code: 'magic_mcp_backing_integration_delete_blocked'
        })
      );
    }

    if (!d._canModifyMagicMcpBacking) {
      let [activeInstanceCount, activeProviderCount] = await Promise.all([
        db.integrationInstance.count({
          where: {
            integrationOid: d.integration.oid,
            status: { in: ['draft', 'active'] }
          }
        }),
        db.integrationProvider.count({
          where: {
            integrationOid: d.integration.oid,
            status: 'active'
          }
        })
      ]);

      if (activeInstanceCount > 0 || activeProviderCount > 0) {
        throw new ServiceError(
          conflictError({
            message:
              'Integration still has active instances or providers and cannot be archived directly.',
            code: 'integration_archive_blocked_by_active_children',
            data: {
              integrationId: d.integration.id,
              activeInstanceCount,
              activeProviderCount
            }
          })
        );
      }
    }

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
