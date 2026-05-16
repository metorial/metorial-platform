import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Prisma, SkillRepository } from '@metorial-cargo/db';
import { db, getId } from '@metorial-cargo/db';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { getOriginTenant, origin } from '../internal/skillDestination';

export let skillRepositoryInclude = {
  marketplaceRepository: {
    include: {
      skillMarketplace: true
    }
  },
  pluginRepository: {
    include: {
      skillPlugin: true
    }
  }
} satisfies Prisma.SkillRepositoryInclude;

export type SkillRepositoryRecord = Prisma.SkillRepositoryGetPayload<{
  include: typeof skillRepositoryInclude;
}>;

export type OriginRepositoryRecord = Awaited<
  ReturnType<typeof origin.scmRepository.getMany>
>['repositories'][number];

export type EnrichedSkillRepositoryRecord = SkillRepositoryRecord & {
  originRepository: OriginRepositoryRecord | null;
};

class SkillRepositoryServiceImpl {
  async getOriginRepositories(d: CargoTenantEnvironment & { repoIds: string[] }) {
    if (d.repoIds.length === 0) return [];

    let originTenant = await getOriginTenant(d.tenant);
    let result = await origin.scmRepository.getMany({
      tenantId: originTenant.id,
      scmRepositoryIds: d.repoIds
    });

    return result.repositories;
  }

  async getOriginRepository(d: CargoTenantEnvironment & { repoId: string }) {
    let repositories = await this.getOriginRepositories({
      tenant: d.tenant,
      environment: d.environment,
      repoIds: [d.repoId]
    });

    let repository = repositories.find(r => r.id === d.repoId);
    if (!repository) throw new ServiceError(notFoundError('origin.repository', d.repoId));

    return repository;
  }

  async enrichSkillRepositories<T extends SkillRepositoryRecord>(
    d: CargoTenantEnvironment & { skillRepositories: T[] }
  ): Promise<(T & { originRepository: OriginRepositoryRecord | null })[]> {
    let originRepositories = await this.getOriginRepositories({
      tenant: d.tenant,
      environment: d.environment,
      repoIds: d.skillRepositories.map(repository => repository.repoId)
    });
    let originRepositoryById = new Map(originRepositories.map(repository => [repository.id, repository]));

    return d.skillRepositories.map(repository => ({
      ...repository,
      originRepository: originRepositoryById.get(repository.repoId) ?? null
    }));
  }

  async ensureSkillRepositoryForRepo(d: CargoTenantEnvironment & { repoId: string }) {
    await this.getOriginRepository(d);

    let existing = await db.skillRepository.findUnique({
      where: { repoId: d.repoId },
      include: skillRepositoryInclude
    });

    if (existing) {
      if (existing.tenantOid !== d.tenant.oid || existing.environmentOid !== d.environment.oid) {
        throw new ServiceError(
          badRequestError({
            message: 'Repository is already linked in another environment'
          })
        );
      }

      return existing;
    }

    return await db.skillRepository.create({
      data: {
        ...getId('skillRepository'),
        repoId: d.repoId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      include: skillRepositoryInclude
    });
  }

  assertRepositoryIsAvailable(
    skillRepository: SkillRepositoryRecord,
    allowed?: {
      skillMarketplaceOid?: bigint;
      skillPluginOid?: bigint;
    }
  ) {
    let marketplaceLink = skillRepository.marketplaceRepository;
    if (
      marketplaceLink &&
      (!allowed?.skillMarketplaceOid ||
        marketplaceLink.skillMarketplaceOid !== allowed.skillMarketplaceOid)
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Repository is already linked to a marketplace'
        })
      );
    }

    let pluginLink = skillRepository.pluginRepository;
    if (pluginLink && (!allowed?.skillPluginOid || pluginLink.skillPluginOid !== allowed.skillPluginOid)) {
      throw new ServiceError(
        badRequestError({
          message: 'Repository is already linked to a plugin'
        })
      );
    }
  }

  async getSkillRepositoryById(d: CargoTenantEnvironment & { skillRepositoryId: string }) {
    let skillRepository = await db.skillRepository.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.skillRepositoryId
      },
      include: skillRepositoryInclude
    });

    if (!skillRepository) throw new ServiceError(notFoundError('skill.repository', d.skillRepositoryId));
    return skillRepository;
  }

  async getSkillRepositoryByRepoId(d: CargoTenantEnvironment & { repoId: string }) {
    let skillRepository = await db.skillRepository.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        repoId: d.repoId
      },
      include: skillRepositoryInclude
    });

    if (!skillRepository) throw new ServiceError(notFoundError('skill.repository', d.repoId));
    return skillRepository;
  }
}

export let skillRepositoryService = Service.create(
  'skillRepositoryService',
  () => new SkillRepositoryServiceImpl()
).build();
