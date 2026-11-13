import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';
import {
  activeSkillRepositoryLinkWhere,
  providerIdentityRefreshIntervalMs,
  refreshSkillRepositoryProviderIdentity
} from '../lib/repositoryIdentity';

let pageSize = 500;
let originBatchSize = 100;

let getStaleIdentityWhere = () => ({
  AND: [
    activeSkillRepositoryLinkWhere,
    {
      OR: [
        { providerIdentityRefreshedAt: null },
        {
          providerIdentityRefreshedAt: {
            lt: new Date(Date.now() - providerIdentityRefreshIntervalMs)
          }
        }
      ]
    }
  ]
});

export let skillRepositoryIdentityRefreshCron = createCron(
  { name: 'cargo/skill/repository/identity/cron', cron: '0 * * * *' },
  async () => {
    await skillRepositoryIdentityRefreshManyQueue.add({});
  }
);

export let skillRepositoryIdentityRefreshManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/skill/repository/identity/many',
  workerOpts: { concurrency: 1 }
});

export let skillRepositoryIdentityRefreshManyQueueProcessor =
  skillRepositoryIdentityRefreshManyQueue.process(async data => {
    let repositories = await db.skillRepository.findMany({
      where: {
        ...getStaleIdentityWhere(),
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true, projectOid: true }
    });
    if (!repositories.length) return;

    let idsByProject = new Map<bigint, string[]>();
    for (let repository of repositories) {
      let ids = idsByProject.get(repository.projectOid) ?? [];
      ids.push(repository.id);
      idsByProject.set(repository.projectOid, ids);
    }

    let batches = [...idsByProject.values()].flatMap(ids =>
      Array.from({ length: Math.ceil(ids.length / originBatchSize) }, (_, index) =>
        ids.slice(index * originBatchSize, (index + 1) * originBatchSize)
      )
    );
    await skillRepositoryIdentityRefreshSingleQueue.addManyWithOps(
      batches.map(skillRepositoryIds => ({
        data: { skillRepositoryIds },
        opts: { id: `identity:${skillRepositoryIds[0]}` }
      }))
    );

    if (repositories.length === pageSize) {
      await skillRepositoryIdentityRefreshManyQueue.add(
        { cursor: repositories[repositories.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  });

export let skillRepositoryIdentityRefreshSingleQueue = createQueue<{
  skillRepositoryIds: string[];
}>({
  name: 'cargo/skill/repository/identity/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let skillRepositoryIdentityRefreshSingleQueueProcessor =
  skillRepositoryIdentityRefreshSingleQueue.process(async data => {
    let repositories = await db.skillRepository.findMany({
      where: { ...getStaleIdentityWhere(), id: { in: data.skillRepositoryIds } },
      include: { project: true }
    });
    let project = repositories[0]?.project;
    if (!project) return;

    let originTenant = await getOriginTenant(project);
    let { repositories: originRepositories } = await origin.scmRepository.getMany({
      tenantId: originTenant.id,
      scmRepositoryIds: repositories.map(repository => repository.repoId)
    });
    let originRepositoryById = new Map(
      originRepositories.map(repository => [repository.id, repository])
    );

    // A repository missing from Origin keeps its last known identity so it can't be claimed
    // elsewhere while it is still linked; only the timestamp moves so the scan skips it.
    for (let repository of repositories) {
      let originRepository = originRepositoryById.get(repository.repoId);
      if (originRepository) {
        await refreshSkillRepositoryProviderIdentity({
          skillRepository: repository,
          originRepository
        });
      } else {
        await db.skillRepository.update({
          where: { oid: repository.oid },
          data: { providerIdentityRefreshedAt: new Date() }
        });
      }
    }
  });

export let skillRepositoryIdentityQueues = combineQueueProcessors([
  skillRepositoryIdentityRefreshCron,
  skillRepositoryIdentityRefreshManyQueueProcessor,
  skillRepositoryIdentityRefreshSingleQueueProcessor
]);
