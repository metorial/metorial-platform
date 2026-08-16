import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Instance, Prisma, Project } from '@metorial/db';
import { db, ID } from '@metorial/db';
import { getOriginTenant, origin } from '@metorial/skills-common/origin';

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

export type OriginScmProvider = 'github' | 'gitlab' | 'bitbucket';

export type OriginScmAccountRecord = {
  object: 'origin#scmAccount';
  id: string;
  provider: OriginScmProvider;
  type: 'user' | 'organization';
  name: string;
  identifier: string;
  externalId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OriginRepositoryRecord = {
  object: 'origin#repository';
  id: string;
  identifier: string;
  name: string;
  provider: OriginScmProvider;
  externalId: string;
  externalOwner: string;
  externalName: string;
  externalUrl: string;
  externalIsPrivate: boolean;
  defaultBranch: string;
  account: OriginScmAccountRecord | undefined;
  createdAt: Date;
  updatedAt: Date;
};

export type EnrichedSkillRepositoryRecord = SkillRepositoryRecord & {
  originRepository: OriginRepositoryRecord | null;
};

type OriginObject<T> = Omit<T, 'object'> & { object: string };

let normalizeOriginScmAccount = (
  account: OriginObject<OriginScmAccountRecord>
): OriginScmAccountRecord => ({
  ...account,
  object: 'origin#scmAccount'
});

let normalizeOriginRepository = (
  repository: Omit<OriginObject<OriginRepositoryRecord>, 'account'> & {
    account: OriginObject<OriginScmAccountRecord> | undefined;
  }
): OriginRepositoryRecord => ({
  ...repository,
  object: 'origin#repository',
  account: repository.account ? normalizeOriginScmAccount(repository.account) : undefined
});

class SkillRepositoryServiceImpl {
  async getOriginRepositories(d: {
    project: Project;
    instance: Instance;
    repoIds: string[];
  }): Promise<OriginRepositoryRecord[]> {
    if (d.repoIds.length === 0) return [];

    let originTenant = await getOriginTenant(d.project);
    let result = await origin.scmRepository.getMany({
      tenantId: originTenant.id,
      scmRepositoryIds: d.repoIds
    });

    return result.repositories.map(normalizeOriginRepository);
  }

  async getOriginRepository(d: {
    project: Project;
    instance: Instance;
    repoId: string;
  }): Promise<OriginRepositoryRecord> {
    let repositories = await this.getOriginRepositories({
      project: d.project,
      instance: d.instance,
      repoIds: [d.repoId]
    });

    let repository = repositories.find(r => r.id === d.repoId);
    if (!repository) throw new ServiceError(notFoundError('origin.repository', d.repoId));

    return repository;
  }

  async enrichSkillRepositories<T extends SkillRepositoryRecord>(d: {
    project: Project;
    instance: Instance;
    skillRepositories: T[];
  }): Promise<(T & { originRepository: OriginRepositoryRecord | null })[]> {
    let originRepositories = await this.getOriginRepositories({
      project: d.project,
      instance: d.instance,
      repoIds: d.skillRepositories.map(repository => repository.repoId)
    });
    let originRepositoryById = new Map(
      originRepositories.map(repository => [repository.id, repository])
    );

    return d.skillRepositories.map(repository => ({
      ...repository,
      originRepository: originRepositoryById.get(repository.repoId) ?? null
    }));
  }

  async ensureSkillRepositoryForRepo(d: {
    project: Project;
    instance: Instance;
    repoId: string;
  }) {
    await this.getOriginRepository(d);

    let existing = await db.skillRepository.findUnique({
      where: { repoId: d.repoId },
      include: skillRepositoryInclude
    });

    if (existing) {
      if (existing.projectOid !== d.project.oid || existing.instanceOid !== d.instance.oid) {
        throw new ServiceError(
          badRequestError({
            message: 'Repository is already linked in another instance'
          })
        );
      }

      return existing;
    }

    return await db.skillRepository.create({
      data: {
        id: await ID.generateId('skillRepository'),
        repoId: d.repoId,
        projectOid: d.project.oid,
        instanceOid: d.instance.oid
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
    if (
      pluginLink &&
      (!allowed?.skillPluginOid || pluginLink.skillPluginOid !== allowed.skillPluginOid)
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Repository is already linked to a plugin'
        })
      );
    }
  }

  async getSkillRepositoryById(d: {
    project: Project;
    instance: Instance;
    skillRepositoryId: string;
  }) {
    let skillRepository = await db.skillRepository.findFirst({
      where: {
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        id: d.skillRepositoryId
      },
      include: skillRepositoryInclude
    });

    if (!skillRepository)
      throw new ServiceError(notFoundError('skill.repository', d.skillRepositoryId));
    return skillRepository;
  }

  async getSkillRepositoryByRepoId(d: {
    project: Project;
    instance: Instance;
    repoId: string;
  }) {
    let skillRepository = await db.skillRepository.findFirst({
      where: {
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
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
