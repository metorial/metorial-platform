import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '@metorial-cargo/db';
import { db, getId } from '@metorial-cargo/db';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import {
  type EnrichedSkillRepositoryRecord,
  skillRepositoryInclude,
  skillRepositoryService
} from './skillRepository';

export let skillMarketplaceRepositoryInclude = {
  skillRepository: {
    include: skillRepositoryInclude
  },
  skillMarketplace: true
} satisfies Prisma.SkillMarketplaceRepositoryInclude;

export type SkillMarketplaceRepositoryRecord = Prisma.SkillMarketplaceRepositoryGetPayload<{
  include: typeof skillMarketplaceRepositoryInclude;
}>;

export type EnrichedSkillMarketplaceRepositoryRecord = Omit<
  SkillMarketplaceRepositoryRecord,
  'skillRepository'
> & {
  skillRepository: EnrichedSkillRepositoryRecord;
};

class SkillMarketplaceRepositoryServiceImpl {
  private async getMarketplace(d: CargoTenantEnvironment & { skillMarketplaceId: string }) {
    let marketplace = await db.skillMarketplace.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.skillMarketplaceId,
        status: 'active'
      }
    });

    if (!marketplace) throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));
    return marketplace;
  }

  private async enrichRepositories<T extends SkillMarketplaceRepositoryRecord>(
    d: CargoTenantEnvironment & { repositories: T[] }
  ): Promise<(Omit<T, 'skillRepository'> & { skillRepository: EnrichedSkillRepositoryRecord })[]> {
    let enrichedSkillRepositories = await skillRepositoryService.enrichSkillRepositories({
      tenant: d.tenant,
      environment: d.environment,
      skillRepositories: d.repositories.map(repository => repository.skillRepository)
    });
    let skillRepositoryByOid = new Map(
      enrichedSkillRepositories.map(repository => [repository.oid, repository])
    );

    return d.repositories.map(repository => ({
      ...repository,
      skillRepository: skillRepositoryByOid.get(repository.skillRepository.oid)!
    }));
  }

  async listSkillMarketplaceRepositories(
    d: CargoTenantEnvironment & {
      skillMarketplaceId: string;
    }
  ) {
    let marketplace = await this.getMarketplace(d);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let repositories = await db.skillMarketplaceRepository.findMany({
            ...opts,
            where: {
              skillMarketplaceOid: marketplace.oid
            },
            include: skillMarketplaceRepositoryInclude
          });

        return await this.enrichRepositories({
          tenant: d.tenant,
          environment: d.environment,
          repositories
        });
      })
    );
  }

  async getSkillMarketplaceRepositoryById(
    d: CargoTenantEnvironment & {
      skillMarketplaceId: string;
      skillMarketplaceRepositoryId: string;
    }
  ) {
    let marketplace = await this.getMarketplace(d);
    let repository = await db.skillMarketplaceRepository.findFirst({
      where: {
        id: d.skillMarketplaceRepositoryId,
        skillMarketplaceOid: marketplace.oid
      },
      include: skillMarketplaceRepositoryInclude
    });

    if (!repository) {
      throw new ServiceError(
        notFoundError('skill.marketplace.repository', d.skillMarketplaceRepositoryId)
      );
    }

    let [enriched] = await this.enrichRepositories({
      tenant: d.tenant,
      environment: d.environment,
      repositories: [repository]
    });

    return enriched!;
  }

  async createSkillMarketplaceRepository(
    d: CargoTenantEnvironment & {
      skillMarketplaceId: string;
      repoId: string;
    }
  ) {
    let marketplace = await this.getMarketplace(d);
    let skillRepository = await skillRepositoryService.ensureSkillRepositoryForRepo({
      tenant: d.tenant,
      environment: d.environment,
      repoId: d.repoId
    });

    skillRepositoryService.assertRepositoryIsAvailable(skillRepository, {
      skillMarketplaceOid: marketplace.oid
    });

    let existing = await db.skillMarketplaceRepository.findFirst({
      where: {
        skillMarketplaceOid: marketplace.oid,
        skillRepositoryOid: skillRepository.oid
      },
      include: skillMarketplaceRepositoryInclude
    });
    if (existing) {
      let [enriched] = await this.enrichRepositories({
        tenant: d.tenant,
        environment: d.environment,
        repositories: [existing]
      });
      return enriched!;
    }

    let repository = await db.skillMarketplaceRepository.create({
      data: {
        ...getId('skillMarketplaceRepository'),
        skillMarketplaceOid: marketplace.oid,
        skillRepositoryOid: skillRepository.oid
      },
      include: skillMarketplaceRepositoryInclude
    });

    let [enriched] = await this.enrichRepositories({
      tenant: d.tenant,
      environment: d.environment,
      repositories: [repository]
    });
    return enriched!;
  }

  async deleteSkillMarketplaceRepository(
    d: CargoTenantEnvironment & {
      skillMarketplaceId: string;
      skillMarketplaceRepositoryId: string;
    }
  ) {
    let repository = await this.getSkillMarketplaceRepositoryById(d);

    await db.skillMarketplaceRepository.delete({
      where: { oid: repository.oid }
    });

    return repository;
  }
}

export let skillMarketplaceRepositoryService = Service.create(
  'skillMarketplaceRepositoryService',
  () => new SkillMarketplaceRepositoryServiceImpl()
).build();
