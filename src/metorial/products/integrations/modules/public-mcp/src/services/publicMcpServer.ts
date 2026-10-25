import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type ProviderDeployment,
  type PublicMcpServer,
  type PublicMcpServerStatus,
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
  resolveProviderDeployments
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  metorialDb,
  assertCanSeeOwnedResource,
  getOwnershipAccessor,
  type MetorialFacing,
  ownedResourceWhere,
  ownerActorSelect,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { validatePortalAllowedRedirectUrlFilters } from '@metorial/consumer-oauth-utils';
import { Fabric } from '@metorial/fabric';
import { publicMcpServerRepository } from '@metorial/multi-region';
import { assertPublicMcpEnabled } from '../lib/flag';
import { assertValidPublicMcpSlug, normalizePublicMcpSlug } from '../lib/slug';
import { publicMcpServerArchivedQueue } from '../queues/serverArchived';

export let publicMcpServerInclude = {
  provider: true,
  deployment: true,
  ownerActor: ownerActorSelect
};

let TTL_BOUNDS = {
  accessTokenTtlSeconds: { min: 5 * 60, max: 24 * 60 * 60 },
  refreshTokenTtlSeconds: { min: 60 * 60, max: 365 * 24 * 60 * 60 },
  grantIdleExpirySeconds: { min: 24 * 60 * 60, max: 365 * 24 * 60 * 60 }
};

let assertTtl = (key: keyof typeof TTL_BOUNDS, value: number | undefined) => {
  if (value === undefined) return;

  let bounds = TTL_BOUNDS[key];
  if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
    throw new ServiceError(
      badRequestError({
        message: `${key} must be an integer between ${bounds.min} and ${bounds.max}.`
      })
    );
  }
};

let validateSettings = (input: PublicMcpServerSettingsInput) => {
  assertTtl('accessTokenTtlSeconds', input.accessTokenTtlSeconds);
  assertTtl('refreshTokenTtlSeconds', input.refreshTokenTtlSeconds);
  assertTtl('grantIdleExpirySeconds', input.grantIdleExpirySeconds);

  if (
    input.maxActiveGrants !== undefined &&
    input.maxActiveGrants !== null &&
    (!Number.isInteger(input.maxActiveGrants) || input.maxActiveGrants < 1)
  ) {
    throw new ServiceError(
      badRequestError({ message: 'max_active_grants must be a positive integer.' })
    );
  }

  if (input.redirectUriFilters) {
    validatePortalAllowedRedirectUrlFilters(
      input.redirectUriFilters.map(url => ({ url })),
      'redirect_uri_filters'
    );
  }
};

let toAuditPublicMcpServer = async (publicMcpServer: PublicMcpServer) =>
  await db.publicMcpServer.findUniqueOrThrow({
    where: { oid: publicMcpServer.oid },
    include: { provider: true, deployment: true }
  });

type PublicMcpServerSettingsInput = {
  toolFilters?: PrismaJson.ToolFilter | null;
  redirectUriFilters?: string[];
  maxActiveGrants?: number | null;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  grantIdleExpirySeconds?: number;
};

export type CreatePublicMcpServerParams = {
  tenant: Tenant;
  environment: Environment;
  providerDeployment: ProviderDeployment;
  ownerActorOid?: bigint | null;
  isSystemOwned?: boolean;
  input: PublicMcpServerSettingsInput & {
    name: string;
    slug: string;
    description?: string;
    metadata?: Record<string, any>;
  };
};

export type UpdatePublicMcpServerParams = {
  tenant: Tenant;
  environment: Environment;
  publicMcpServer: PublicMcpServer;
  input: PublicMcpServerSettingsInput & {
    name?: string;
    slug?: string;
    description?: string | null;
    metadata?: Record<string, any>;
    status?: 'active' | 'disabled';
  };
};

export type ArchivePublicMcpServerParams = {
  tenant: Tenant;
  environment: Environment;
  publicMcpServer: PublicMcpServer;
};

type ListPublicMcpServersParams = {
  status?: PublicMcpServerStatus[];
  allowDeleted?: boolean;
  includeSystemOwned?: boolean;
  ownershipWhere?: Record<string, any>;

  ids?: string[];
  providerDeploymentIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetPublicMcpServerByIdParams = {
  publicMcpServerId: string;
  allowDeleted?: boolean;
  includeSystemOwned?: boolean;
};

class publicMcpServerServiceImpl {
  async listPublicMcpServers(d: MetorialFacing<ListPublicMcpServersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let accessor = await getOwnershipAccessor({ tenant: scope.tenant, organizationActor });

    return this.listPublicMcpServersInternal({
      ...rest,
      ownershipWhere: ownedResourceWhere(accessor, {
        ownership: 'all',
        includeSystemOwned: d.includeSystemOwned
      }),
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listPublicMcpServersInternal(
    d: { tenant: Tenant; environment: Environment } & ListPublicMcpServersParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.publicMcpServer.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ownershipWhere ?? undefined!,
                d.includeSystemOwned ? undefined! : { isSystemOwned: false },
                d.ids ? { id: { in: d.ids } } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: publicMcpServerInclude
          })
      )
    );
  }

  async getPublicMcpServerById(d: MetorialFacing<GetPublicMcpServerByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let publicMcpServer = await this.getPublicMcpServerByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    assertCanSeeOwnedResource(
      await getOwnershipAccessor({ tenant: scope.tenant, organizationActor }),
      publicMcpServer,
      { resource: 'public_mcp_server', id: d.publicMcpServerId }
    );

    return publicMcpServer;
  }

  async getPublicMcpServerByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetPublicMcpServerByIdParams
  ) {
    let solution = await getMetorialSolution();
    let publicMcpServer = await db.publicMcpServer.findFirst({
      where: {
        id: d.publicMcpServerId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        isSystemOwned: d.includeSystemOwned ? undefined : false,
        ...normalizeStatusForGet(d).noParent
      },
      include: publicMcpServerInclude
    });
    if (!publicMcpServer) {
      throw new ServiceError(notFoundError('public_mcp_server', d.publicMcpServerId));
    }

    return publicMcpServer;
  }

  async isSlugAvailable(d: { slug: string }) {
    let slug = normalizePublicMcpSlug(d.slug);
    assertValidPublicMcpSlug(slug);

    return await publicMcpServerRepository.isSlugAvailable({ slug });
  }

  async createPublicMcpServer(d: MetorialFacing<CreatePublicMcpServerParams>) {
    let { instance, organizationActor, ...rest } = d;
    await assertPublicMcpEnabled({ instanceOid: instance.oid });

    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.public_mcp_server.created:before', eventBase);

    let publicMcpServer = await this.createPublicMcpServerInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.public_mcp_server.created:after', {
      ...eventBase,
      publicMcpServer: await toAuditPublicMcpServer(publicMcpServer)
    });

    return publicMcpServer;
  }

  async createPublicMcpServerInternal(d: CreatePublicMcpServerParams) {
    checkTenant(d, d.providerDeployment);
    checkDeletedRelation(d.providerDeployment);
    validateSettings(d.input);

    let name = d.input.name.trim();
    if (!name) throw new ServiceError(badRequestError({ message: 'name is required.' }));

    let slug = normalizePublicMcpSlug(d.input.slug);
    assertValidPublicMcpSlug(slug);

    let solution = await getMetorialSolution();
    let instance = await metorialDb.instance.findUniqueOrThrow({
      where: { oid: d.environment.instanceOid! },
      include: { organization: true }
    });

    let ids = getId('publicMcpServer');

    // The global registry is the source of truth for slug ownership, so it is claimed first
    // and released again if the local write fails.
    await publicMcpServerRepository.reserve({
      id: ids.id,
      slug,
      organizationId: instance.organization.id,
      instanceId: instance.id
    });

    try {
      return await db.publicMcpServer.create({
        data: {
          ...ids,
          status: 'active',
          slug,

          name,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          toolFilter: d.input.toolFilters ?? { type: 'v1.allow_all' },
          redirectUriFilters: d.input.redirectUriFilters ?? [],
          maxActiveGrants: d.input.maxActiveGrants ?? null,
          accessTokenTtlSeconds: d.input.accessTokenTtlSeconds,
          refreshTokenTtlSeconds: d.input.refreshTokenTtlSeconds,
          grantIdleExpirySeconds: d.input.grantIdleExpirySeconds,

          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid!,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid!,
          providerOid: d.providerDeployment.providerOid,
          deploymentOid: d.providerDeployment.oid,
          ownerActorOid: d.isSystemOwned ? null : (d.ownerActorOid ?? null),
          isSystemOwned: !!d.isSystemOwned
        },
        include: publicMcpServerInclude
      });
    } catch (err) {
      await publicMcpServerRepository.release({ id: ids.id }).catch(() => {});
      throw err;
    }
  }

  async updatePublicMcpServer(d: MetorialFacing<UpdatePublicMcpServerParams>) {
    let { instance, organizationActor, ...rest } = d;
    if (d.input.status === 'active') {
      await assertPublicMcpEnabled({ instanceOid: instance.oid });
    }

    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.public_mcp_server.updated:before', eventBase);

    let previousPublicMcpServer = await toAuditPublicMcpServer(d.publicMcpServer);

    let publicMcpServer = await this.updatePublicMcpServerInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.public_mcp_server.updated:after', {
      ...eventBase,
      publicMcpServer: await toAuditPublicMcpServer(publicMcpServer),
      previousPublicMcpServer
    });

    return publicMcpServer;
  }

  async updatePublicMcpServerInternal(d: UpdatePublicMcpServerParams) {
    checkTenant(d, d.publicMcpServer);
    checkDeletedEdit(d.publicMcpServer, 'update');
    validateSettings(d.input);

    let name = d.input.name?.trim();
    if (d.input.name !== undefined && !name) {
      throw new ServiceError(badRequestError({ message: 'name cannot be empty.' }));
    }

    let slug = d.input.slug !== undefined ? normalizePublicMcpSlug(d.input.slug) : undefined;
    if (slug !== undefined) assertValidPublicMcpSlug(slug);

    let isRenamed = slug !== undefined && slug !== d.publicMcpServer.slug;
    if (isRenamed) {
      await publicMcpServerRepository.rename({ id: d.publicMcpServer.id, slug: slug! });
    }

    let statusChange =
      d.input.status && d.input.status !== d.publicMcpServer.status
        ? d.input.status
        : undefined;

    try {
      let publicMcpServer = await db.publicMcpServer.update({
        where: { oid: d.publicMcpServer.oid },
        data: {
          name,
          slug: isRenamed ? slug : undefined,
          description:
            d.input.description === null ? null : d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          toolFilter: d.input.toolFilters ?? undefined,
          redirectUriFilters: d.input.redirectUriFilters,
          maxActiveGrants: d.input.maxActiveGrants,
          accessTokenTtlSeconds: d.input.accessTokenTtlSeconds,
          refreshTokenTtlSeconds: d.input.refreshTokenTtlSeconds,
          grantIdleExpirySeconds: d.input.grantIdleExpirySeconds,

          ...(statusChange
            ? {
                status: statusChange,
                disabledAt: statusChange === 'disabled' ? new Date() : null
              }
            : {})
        },
        include: publicMcpServerInclude
      });

      if (statusChange) {
        await publicMcpServerRepository.setStatus({
          id: publicMcpServer.id,
          status: statusChange
        });
      }

      return publicMcpServer;
    } catch (err) {
      if (isRenamed) {
        await publicMcpServerRepository
          .rename({ id: d.publicMcpServer.id, slug: d.publicMcpServer.slug })
          .catch(() => {});
      }
      throw err;
    }
  }

  async archivePublicMcpServer(d: MetorialFacing<ArchivePublicMcpServerParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.public_mcp_server.archived:before', eventBase);

    let publicMcpServer = await this.archivePublicMcpServerInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.public_mcp_server.archived:after', {
      ...eventBase,
      publicMcpServer: await toAuditPublicMcpServer(publicMcpServer)
    });

    return publicMcpServer;
  }

  async archivePublicMcpServerInternal(d: ArchivePublicMcpServerParams) {
    checkTenant(d, d.publicMcpServer);
    checkDeletedEdit(d.publicMcpServer, 'archive');

    let publicMcpServer = await withTransaction(async db => {
      let publicMcpServer = await db.publicMcpServer.update({
        where: { oid: d.publicMcpServer.oid },
        data: { status: 'archived', archivedAt: new Date() },
        include: publicMcpServerInclude
      });

      await addAfterTransactionHook(async () =>
        publicMcpServerArchivedQueue.add({ publicMcpServerId: publicMcpServer.id })
      );

      return publicMcpServer;
    });

    await publicMcpServerRepository.setStatus({ id: publicMcpServer.id, status: 'archived' });

    return publicMcpServer;
  }
}

export let publicMcpServerService = Service.create(
  'publicMcpServer',
  () => new publicMcpServerServiceImpl()
).build();
