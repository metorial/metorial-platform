import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import type { CargoResourceScope } from '@metorial/cargo-module-file';
import type { Prisma } from '@metorial/db';
import { db } from '@metorial/db';
import { forceSkillDestinationSync } from '../internal/skillDestination';
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
  private async getMarketplace(d: CargoResourceScope & { skillMarketplaceId: string }) {
    let marketplace = await db.skillMarketplace.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        id: d.skillMarketplaceId,
        status: 'active'
      }
    });

    if (!marketplace)
      throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));
    return marketplace;
  }

  private async enrichRepositories<T extends SkillMarketplaceRepositoryRecord>(
    d: CargoResourceScope & { repositories: T[] }
  ): Promise<
    (Omit<T, 'skillRepository'> & { skillRepository: EnrichedSkillRepositoryRecord })[]
  > {
    let enrichedSkillRepositories = await skillRepositoryService.enrichSkillRepositories({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
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
    d: CargoResourceScope & {
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
          resourceTenant: d.resourceTenant!,
          resourceGroup: d.resourceGroup,
          repositories
        });
      })
    );
  }

  async getSkillMarketplaceRepositoryById(
    d: CargoResourceScope & {
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
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      repositories: [repository]
    });

    return enriched!;
  }

  async createSkillMarketplaceRepository(
    d: CargoResourceScope & {
      skillMarketplaceId: string;
      repoId: string;
    }
  ) {
    let marketplace = await this.getMarketplace(d);
    let skillRepository = await skillRepositoryService.ensureSkillRepositoryForRepo({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
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
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
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

    await forceSkillDestinationSync({
      destination: { oid: marketplace.destinationOid! },
      repository: { id: skillRepository.id }
    });

    let [enriched] = await this.enrichRepositories({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      repositories: [repository]
    });
    return enriched!;
  }

  async deleteSkillMarketplaceRepository(
    d: CargoResourceScope & {
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
