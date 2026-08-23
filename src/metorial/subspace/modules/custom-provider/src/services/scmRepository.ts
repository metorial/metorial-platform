import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter, resolveCustomProviders } from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { ensureScmRepoForOrigin } from '../internal/linkRepo';
import {
  getTenantForOrigin,
  normalizeScmAccountPreview,
  normalizeScmRepositoryPreview,
  origin,
  type ScmAccountPreview,
  type ScmRepositoryPreview
} from '../origin';

type ListScmRepositoriesParams = {
  createdAt?: DateFilter;
  updatedAt?: DateFilter;

  ids?: string[];
  customProviderIds?: string[];
};

type GetScmRepositoryByIdParams = {
  scmRepositoryId: string;
};

type CreateScmRepositoryParams = {
  input: {
    scmConnectionId: string;
    externalAccountId: string;
    name: string;
    description?: string;
    isPrivate: boolean;
  };
};

type LinkScmRepositoryParams = {
  input: {
    scmConnectionId: string;
    externalId: string;
  };
};

type ListScmAccountPreviewsParams = {
  input: {
    scmConnectionId: string;
  };
};

type ListScmRepositoryPreviewsParams = {
  input: {
    scmConnectionId: string;
    externalAccountId?: string;
    cursor?: string;
    limit?: number;
  };
};

class scmRepositoryServiceImpl {
  async listScmRepositories(d: MetorialFacing<ListScmRepositoriesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listScmRepositoriesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listScmRepositoriesInternal(
    d: { tenant: Tenant; environment: Environment } & ListScmRepositoriesParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let customProviders = await resolveCustomProviders(ts, d.customProviderIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmRepo.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                customProviders
                  ? { customProviders: { some: customProviders.oidIn } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            }
          })
      )
    );
  }

  async getScmRepositoryById(d: MetorialFacing<GetScmRepositoryByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getScmRepositoryByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getScmRepositoryByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetScmRepositoryByIdParams
  ) {
    let solution = await getMetorialSolution();
    let scmRepo = await db.scmRepo.findFirst({
      where: {
        id: d.scmRepositoryId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid
      }
    });
    if (!scmRepo) throw new ServiceError(notFoundError('scm.repository', d.scmRepositoryId));

    return scmRepo;
  }

  async createScmRepository(d: MetorialFacing<CreateScmRepositoryParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.createScmRepositoryInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createScmRepositoryInternal(
    d: { tenant: Tenant; environment: Environment } & CreateScmRepositoryParams
  ) {
    let solution = await getMetorialSolution();
    let tenant = await getTenantForOrigin(d.tenant);
    let originRes = await origin.scmRepository.create({
      tenantId: tenant.id,
      scmInstallationId: d.input.scmConnectionId,
      externalAccountId: d.input.externalAccountId,
      name: d.input.name,
      description: d.input.description,
      isPrivate: d.input.isPrivate
    });

    return await ensureScmRepoForOrigin({
      originRepo: originRes,
      tenant: d.tenant,
      solution
    });
  }

  async linkScmRepository(d: MetorialFacing<LinkScmRepositoryParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.linkScmRepositoryInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async linkScmRepositoryInternal(
    d: { tenant: Tenant; environment: Environment } & LinkScmRepositoryParams
  ) {
    let solution = await getMetorialSolution();
    let tenant = await getTenantForOrigin(d.tenant);
    let originRes = await origin.scmRepository.link({
      tenantId: tenant.id,
      scmInstallationId: d.input.scmConnectionId,
      externalId: d.input.externalId
    });

    return await ensureScmRepoForOrigin({
      originRepo: originRes,
      tenant: d.tenant,
      solution
    });
  }

  async listScmAccountPreviews(d: MetorialFacing<ListScmAccountPreviewsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listScmAccountPreviewsInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async listScmAccountPreviewsInternal(
    d: { tenant: Tenant } & ListScmAccountPreviewsParams
  ): Promise<{ accounts: ScmAccountPreview[] }> {
    let tenant = await getTenantForOrigin(d.tenant);
    let result = await origin.scmRepository.listAccountPreviews({
      tenantId: tenant.id,
      scmInstallationId: d.input.scmConnectionId
    });

    return {
      accounts: result.accounts.map(normalizeScmAccountPreview)
    };
  }

  async listScmRepositoryPreviews(d: MetorialFacing<ListScmRepositoryPreviewsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listScmRepositoryPreviewsInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async listScmRepositoryPreviewsInternal(
    d: { tenant: Tenant } & ListScmRepositoryPreviewsParams
  ): Promise<{ repositories: ScmRepositoryPreview[]; nextCursor: string | null }> {
    let tenant = await getTenantForOrigin(d.tenant);
    let result = await origin.scmRepository.listRepositoryPreviews({
      tenantId: tenant.id,
      scmInstallationId: d.input.scmConnectionId,
      externalAccountId: d.input.externalAccountId,
      cursor: d.input.cursor,
      limit: d.input.limit
    });

    return {
      repositories: result.repositories.map(normalizeScmRepositoryPreview),
      nextCursor: result.nextCursor
    };
  }
}

export let scmRepositoryService = Service.create(
  'scmRepository',
  () => new scmRepositoryServiceImpl()
).build();
