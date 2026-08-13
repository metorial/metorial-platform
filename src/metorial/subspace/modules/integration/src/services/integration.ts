import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
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
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
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

export type ListIntegrationsParams = {
  search?: string;
  includeMagicMcpBackings?: boolean;

  status?: IntegrationStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  providerIds?: string[];
  integrationProviderIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIntegrationByIdParams = {
  integrationId: string;
  allowDeleted?: boolean;
};

export type CreateIntegrationParams = {
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
};

export type UpsertMagicMcpIntegrationParams = {
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
};

export type UpdateIntegrationParams = {
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
};

export type ArchiveIntegrationParams = {
  integration: Integration;
  _canModifyMagicMcpBacking?: boolean;
};

class integrationServiceImpl {
  private integrationCreateData(d: {
    tenant: Tenant;
    solution: { oid: number };
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
      projectOid: d.tenant.projectOid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      instanceOid: d.environment.instanceOid
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

  async listIntegrations(d: MetorialFacing<ListIntegrationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listIntegrationsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listIntegrationsInternal(
    d: { tenant: Tenant; environment: Environment } & ListIntegrationsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let providers = await resolveProviders(ts, d.providerIds);
    let integrationProviders = await resolveIntegrationProviders(ts, d.integrationProviderIds);
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
              solutionOid: solution.oid,
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

  async getIntegrationById(d: MetorialFacing<GetIntegrationByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getIntegrationByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getIntegrationByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetIntegrationByIdParams
  ) {
    let solution = await getMetorialSolution();

    let integration = await db.integration.findFirst({
      where: {
        id: d.integrationId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: integrationInclude
    });
    if (!integration) throw new ServiceError(notFoundError('integration', d.integrationId));

    return integration;
  }

  async createIntegration(d: MetorialFacing<CreateIntegrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.integration.created:before', eventBase);

    let integration = await this.createIntegrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.integration.created:after', { ...eventBase, integration });

    return integration;
  }

  async createIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & CreateIntegrationParams
  ) {
    let solution = await getMetorialSolution();

    return await withTransaction(async db => {
      let newId = getId('integration');
      let integration = await db.integration.create({
        data: this.integrationCreateData({
          tenant: d.tenant,
          solution,
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

  async upsertMagicMcpIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & UpsertMagicMcpIntegrationParams
  ) {
    let solution = await getMetorialSolution();

    return await withTransaction(async db => {
      if (d.integration) {
        checkTenant(d, d.integration);

        let integration = await db.integration.update({
          where: {
            oid: d.integration.oid,
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
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
          solution,
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

  async updateIntegration(d: MetorialFacing<UpdateIntegrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateIntegrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateIntegrationParams
  ) {
    let solution = await getMetorialSolution();

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
          solutionOid: solution.oid,
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

  async archiveIntegration(d: MetorialFacing<ArchiveIntegrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.integration.deleted:before', eventBase);

    let integration = await this.archiveIntegrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.integration.deleted:after', { ...eventBase, integration });

    return integration;
  }

  async archiveIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveIntegrationParams
  ) {
    let solution = await getMetorialSolution();

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

    return await withTransaction(async db => {
      let integration = await db.integration.update({
        where: {
          oid: d.integration.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
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

  async deleteIntegration(d: MetorialFacing<ArchiveIntegrationParams>) {
    return await this.archiveIntegration(d);
  }

  async deleteIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveIntegrationParams
  ) {
    return await this.archiveIntegrationInternal(d);
  }
}

export let integrationService = Service.create(
  'integration',
  () => new integrationServiceImpl()
).build();
