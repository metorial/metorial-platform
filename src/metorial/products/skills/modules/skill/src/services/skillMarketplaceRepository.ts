import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, Prisma, Project } from '@metorial/db';
import { db, ID } from '@metorial/db';
import { forceSkillDestinationSync } from '../internal/skillDestination';
import {
  type EnrichedSkillRepositoryRecord,
  skillRepositoryInclude,
  skillRepositoryService
} from './skillRepository';
import { skillMarketplaceService } from './skillMarketplace';

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
  private async enrichRepositories<T extends SkillMarketplaceRepositoryRecord>(d: {
    project: Project;
    instance: Instance;
    repositories: T[];
  }): Promise<
    (Omit<T, 'skillRepository'> & { skillRepository: EnrichedSkillRepositoryRecord })[]
  > {
    let enrichedSkillRepositories = await skillRepositoryService.enrichSkillRepositories({
      project: d.project,
      instance: d.instance,
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

  async listSkillMarketplaceRepositories(d: {
    project: Project;
    instance: Instance;
    skillMarketplaceId: string;
  }) {
    let marketplace = await skillMarketplaceService.getSkillMarketplaceById(d);
    if (marketplace.status !== 'active') {
      throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));
    }

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
          project: d.project,
          instance: d.instance,
          repositories
        });
      })
    );
  }

  async getSkillMarketplaceRepositoryById(d: {
    project: Project;
    instance: Instance;
    skillMarketplaceId: string;
    skillMarketplaceRepositoryId: string;
  }) {
    let marketplace = await skillMarketplaceService.getSkillMarketplaceById(d);
    if (marketplace.status !== 'active') {
      throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));
    }
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
      project: d.project,
      instance: d.instance,
      repositories: [repository]
    });

    return enriched!;
  }

  async createSkillMarketplaceRepository(d: {
    project: Project;
    instance: Instance;
    skillMarketplaceId: string;
    repoId: string;
  }) {
    let marketplace = await skillMarketplaceService.getSkillMarketplaceById(d);
    if (marketplace.status !== 'active') {
      throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));
    }
    let skillRepository = await skillRepositoryService.ensureSkillRepositoryForRepo({
      project: d.project,
      instance: d.instance,
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
        project: d.project,
        instance: d.instance,
        repositories: [existing]
      });
      return enriched!;
    }

    let repository = await db.skillMarketplaceRepository.create({
      data: {
        id: await ID.generateId('skillMarketplaceRepository'),
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
      project: d.project,
      instance: d.instance,
      repositories: [repository]
    });
    return enriched!;
  }

  async deleteSkillMarketplaceRepository(d: {
    project: Project;
    instance: Instance;
    skillMarketplaceId: string;
    skillMarketplaceRepositoryId: string;
  }) {
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
