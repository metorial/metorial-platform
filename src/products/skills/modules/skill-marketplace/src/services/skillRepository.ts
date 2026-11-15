import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Instance, Prisma, Project, SkillRepository } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';
import {
  findConflictingSkillRepository,
  getProviderIdentityUpdate,
  getProviderRepositoryIdentity,
  repositoryLinkedElsewhereMessage
} from '../lib/repositoryIdentity';

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
    let originRepository = await this.getOriginRepository(d);
    let identity = getProviderRepositoryIdentity(originRepository);

    return await withTransaction(async db => {
      let existing = await db.skillRepository.findUnique({
        where: { repoId: d.repoId },
        include: skillRepositoryInclude
      });

      if (
        existing &&
        (existing.projectOid !== d.project.oid || existing.instanceOid !== d.instance.oid)
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Repository is already linked in another instance'
          })
        );
      }

      let skillRepository =
        existing ??
        (await db.skillRepository.create({
          data: {
            id: await ID.generateId('skillRepository'),
            repoId: d.repoId,
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,

            providerRepositoryKey: identity.key,
            providerRepositoryPath: identity.path,
            providerIdentityRefreshedAt: new Date(),

            deletionsAppliedAt: new Date()
          },
          include: skillRepositoryInclude
        }));

      let identityUpdate = getProviderIdentityUpdate({
        skillRepository,
        identity,
        now: new Date()
      });
      if (identityUpdate) {
        skillRepository = await db.skillRepository.update({
          where: { oid: skillRepository.oid },
          data: identityUpdate,
          include: skillRepositoryInclude
        });
      }

      await this.assertProviderRepositoryAvailable({ skillRepository });

      return skillRepository;
    });
  }

  // Must run in the transaction that creates the link: the advisory locks serialize concurrent
  // links of the same provider repository until that transaction commits.
  async assertProviderRepositoryAvailable(d: {
    skillRepository: Pick<
      SkillRepository,
      'oid' | 'providerRepositoryKey' | 'providerRepositoryPath'
    >;
  }) {
    let identity = {
      key: d.skillRepository.providerRepositoryKey,
      path: d.skillRepository.providerRepositoryPath
    };
    let lockKeys = [identity.key, identity.path]
      .filter((value): value is string => !!value)
      .map(value => `skill-repository-provider:${value}`)
      .sort();

    await withTransaction(async db => {
      for (let lockKey of lockKeys) {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      }

      let owner = await findConflictingSkillRepository({
        skillRepositoryOid: d.skillRepository.oid,
        identity
      });
      if (owner) {
        throw new ServiceError(badRequestError({ message: repositoryLinkedElsewhereMessage }));
      }
    });
  }

  async assertRepositoryIsAvailable(
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
