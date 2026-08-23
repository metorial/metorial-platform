import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, Prisma, Project } from '@metorial/db';
import { db, ID } from '@metorial/db';
import { forceSkillDestinationSync } from '../lib/destinationSync';
import {
  type EnrichedSkillRepositoryRecord,
  skillRepositoryInclude,
  skillRepositoryService
} from './skillRepository';
import { skillPluginService } from './skillPlugin';

export let skillPluginRepositoryInclude = {
  skillRepository: {
    include: skillRepositoryInclude
  },
  skillPlugin: true
} satisfies Prisma.SkillPluginRepositoryInclude;

export type SkillPluginRepositoryRecord = Prisma.SkillPluginRepositoryGetPayload<{
  include: typeof skillPluginRepositoryInclude;
}>;

export type EnrichedSkillPluginRepositoryRecord = Omit<
  SkillPluginRepositoryRecord,
  'skillRepository'
> & {
  skillRepository: EnrichedSkillRepositoryRecord;
};

class SkillPluginRepositoryServiceImpl {
  private async enrichRepositories<T extends SkillPluginRepositoryRecord>(d: {
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

  async listSkillPluginRepositories(d: {
    project: Project;
    instance: Instance;
    skillPluginId: string;
  }) {
    let plugin = await skillPluginService.getSkillPluginById(d);
    if (plugin.status !== 'active' || plugin.isManaged) {
      throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let repositories = await db.skillPluginRepository.findMany({
          ...opts,
          where: {
            skillPluginOid: plugin.oid
          },
          include: skillPluginRepositoryInclude
        });

        return await this.enrichRepositories({
          project: d.project,
          instance: d.instance,
          repositories
        });
      })
    );
  }

  async getSkillPluginRepositoryById(d: {
    project: Project;
    instance: Instance;
    skillPluginId: string;
    skillPluginRepositoryId: string;
  }) {
    let plugin = await skillPluginService.getSkillPluginById(d);
    if (plugin.status !== 'active' || plugin.isManaged) {
      throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));
    }
    let repository = await db.skillPluginRepository.findFirst({
      where: {
        id: d.skillPluginRepositoryId,
        skillPluginOid: plugin.oid
      },
      include: skillPluginRepositoryInclude
    });

    if (!repository) {
      throw new ServiceError(
        notFoundError('skill.plugin.repository', d.skillPluginRepositoryId)
      );
    }

    let [enriched] = await this.enrichRepositories({
      project: d.project,
      instance: d.instance,
      repositories: [repository]
    });

    return enriched!;
  }

  async createSkillPluginRepository(d: {
    project: Project;
    instance: Instance;
    skillPluginId: string;
    repoId: string;
  }) {
    let plugin = await skillPluginService.getSkillPluginById(d);
    if (plugin.status !== 'active' || plugin.isManaged) {
      throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));
    }
    let skillRepository = await skillRepositoryService.ensureSkillRepositoryForRepo({
      project: d.project,
      instance: d.instance,
      repoId: d.repoId
    });

    skillRepositoryService.assertRepositoryIsAvailable(skillRepository, {
      skillPluginOid: plugin.oid
    });

    let existing = await db.skillPluginRepository.findFirst({
      where: {
        skillPluginOid: plugin.oid,
        skillRepositoryOid: skillRepository.oid
      },
      include: skillPluginRepositoryInclude
    });
    if (existing) {
      let [enriched] = await this.enrichRepositories({
        project: d.project,
        instance: d.instance,
        repositories: [existing]
      });
      return enriched!;
    }

    let repository = await db.skillPluginRepository.create({
      data: {
        id: await ID.generateId('skillPluginRepository'),
        skillPluginOid: plugin.oid,
        skillRepositoryOid: skillRepository.oid
      },
      include: skillPluginRepositoryInclude
    });

    await forceSkillDestinationSync({
      destination: { oid: plugin.destinationOid! }
    });

    let [enriched] = await this.enrichRepositories({
      project: d.project,
      instance: d.instance,
      repositories: [repository]
    });
    return enriched!;
  }

  async deleteSkillPluginRepository(d: {
    project: Project;
    instance: Instance;
    skillPluginId: string;
    skillPluginRepositoryId: string;
  }) {
    let repository = await this.getSkillPluginRepositoryById(d);

    await db.skillPluginRepository.delete({
      where: { oid: repository.oid }
    });

    return repository;
  }
}

export let skillPluginRepositoryService = Service.create(
  'skillPluginRepositoryService',
  () => new SkillPluginRepositoryServiceImpl()
).build();
