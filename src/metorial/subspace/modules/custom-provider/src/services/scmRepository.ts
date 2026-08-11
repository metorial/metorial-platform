import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter, resolveCustomProviders } from '@metorial-subspace/list-utils';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';
import { ensureScmRepoForOrigin } from '../internal/linkRepo';
import {
  getTenantForOrigin,
  normalizeScmAccountPreview,
  normalizeScmRepositoryPreview,
  origin,
  type ScmAccountPreview,
  type ScmRepositoryPreview
} from '../origin';

class scmRepositoryServiceImpl {
  async listScmRepositories(d: {
    tenant: Tenant;
    environment: Environment;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    customProviderIds?: string[];
  }) {
    let solution = await getMetorialSolution();
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);

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

  async getScmRepositoryById(d: {
    tenant: Tenant;
    environment: Environment;

    scmRepositoryId: string;
  }) {
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

  async createScmRepository(d: {
    tenant: Tenant;
    environment: Environment;

    input: {
      scmConnectionId: string;
      externalAccountId: string;
      name: string;
      description?: string;
      isPrivate: boolean;
    };
  }) {
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

  async linkScmRepository(d: {
    tenant: Tenant;
    environment: Environment;

    input: {
      scmConnectionId: string;
      externalId: string;
    };
  }) {
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

  async listScmAccountPreviews(d: {
    tenant: Tenant;
    input: {
      scmConnectionId: string;
    };
  }): Promise<{ accounts: ScmAccountPreview[] }> {
    let tenant = await getTenantForOrigin(d.tenant);
    let result = await origin.scmRepository.listAccountPreviews({
      tenantId: tenant.id,
      scmInstallationId: d.input.scmConnectionId
    });

    return {
      accounts: result.accounts.map(normalizeScmAccountPreview)
    };
  }

  async listScmRepositoryPreviews(d: {
    tenant: Tenant;
    input: {
      scmConnectionId: string;
      externalAccountId?: string;
      cursor?: string;
      limit?: number;
    };
  }): Promise<{ repositories: ScmRepositoryPreview[]; nextCursor: string | null }> {
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
