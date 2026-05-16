import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '@metorial-cargo/db';
import { db, getId } from '@metorial-cargo/db';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { forceSkillDestinationSync } from '../internal/skillDestination';
import {
  type EnrichedSkillRepositoryRecord,
  skillRepositoryInclude,
  skillRepositoryService
} from './skillRepository';

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
  private async getPlugin(d: CargoTenantEnvironment & { skillPluginId: string }) {
    let plugin = await db.skillPlugin.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.skillPluginId,
        status: 'active',
        isManaged: false
      }
    });

    if (!plugin) throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));
    return plugin;
  }

  private async enrichRepositories<T extends SkillPluginRepositoryRecord>(
    d: CargoTenantEnvironment & { repositories: T[] }
  ): Promise<
    (Omit<T, 'skillRepository'> & { skillRepository: EnrichedSkillRepositoryRecord })[]
  > {
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

  async listSkillPluginRepositories(
    d: CargoTenantEnvironment & {
      skillPluginId: string;
    }
  ) {
    let plugin = await this.getPlugin(d);

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
          tenant: d.tenant,
          environment: d.environment,
          repositories
        });
      })
    );
  }

  async getSkillPluginRepositoryById(
    d: CargoTenantEnvironment & {
      skillPluginId: string;
      skillPluginRepositoryId: string;
    }
  ) {
    let plugin = await this.getPlugin(d);
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
      tenant: d.tenant,
      environment: d.environment,
      repositories: [repository]
    });

    return enriched!;
  }

  async createSkillPluginRepository(
    d: CargoTenantEnvironment & {
      skillPluginId: string;
      repoId: string;
    }
  ) {
    let plugin = await this.getPlugin(d);
    let skillRepository = await skillRepositoryService.ensureSkillRepositoryForRepo({
      tenant: d.tenant,
      environment: d.environment,
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
        tenant: d.tenant,
        environment: d.environment,
        repositories: [existing]
      });
      return enriched!;
    }

    let repository = await db.skillPluginRepository.create({
      data: {
        ...getId('skillPluginRepository'),
        skillPluginOid: plugin.oid,
        skillRepositoryOid: skillRepository.oid
      },
      include: skillPluginRepositoryInclude
    });

    await forceSkillDestinationSync({
      destination: { oid: plugin.destinationOid }
    });

    let [enriched] = await this.enrichRepositories({
      tenant: d.tenant,
      environment: d.environment,
      repositories: [repository]
    });
    return enriched!;
  }

  async deleteSkillPluginRepository(
    d: CargoTenantEnvironment & {
      skillPluginId: string;
      skillPluginRepositoryId: string;
    }
  ) {
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
