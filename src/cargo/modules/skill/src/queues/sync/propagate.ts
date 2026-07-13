import { generatePlainId } from '@lowerdeck/id';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, env, getId, withTransaction } from '@metorial-cargo/db';
import { getOriginTenant, origin } from '../../internal/skillDestination';
import {
  appendSkillDestinationSyncLog,
  appendSkillDestinationSyncLogs,
  type SkillDestinationSyncLogEntry
} from './_lib/logs';
import { syncFinishQueue } from './finish';

let failSync = async (d: { skillDestinationSyncId: string; error: unknown }) => {
  let errorMessage = d.error instanceof Error ? d.error.message : String(d.error);

  await db.skillDestinationSync.updateMany({
    where: {
      id: d.skillDestinationSyncId,
      status: 'processing'
    },
    data: {
      status: 'failed',
      completedAt: new Date()
    }
  });
  await appendSkillDestinationSyncLog(d.skillDestinationSyncId, 'Sync failed.');

  return errorMessage;
};

let formatRepositoryName = (
  repository?: { externalOwner: string; externalName: string } | null
) => (repository ? `${repository.externalOwner}/${repository.externalName}` : 'repository');

let normalizeOriginLogs = (logs: unknown, prefix: string): SkillDestinationSyncLogEntry[] => {
  if (!Array.isArray(logs)) return [];

  return logs.flatMap(log => {
    if (
      Array.isArray(log) &&
      typeof log[0] === 'number' &&
      Number.isFinite(log[0]) &&
      typeof log[1] === 'string'
    ) {
      return [[log[0], `${prefix}: ${log[1]}`] satisfies SkillDestinationSyncLogEntry];
    }

    return [];
  });
};

export let syncPropagateStartQueue = createQueue<{
  skillDestinationSyncId: string;
  skillRepositoryId?: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/propagate/start',
  workerOpts: {
    concurrency: 10
  }
});

export let syncPropagateStartQueueProcessor = syncPropagateStartQueue.process(async data => {
  let sync = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId },
    include: {
      destination: {
        include: {
          skillMarketplace: {
            include: {
              repositories: {
                include: {
                  skillRepository: true
                }
              }
            }
          },
          skillPlugin: {
            include: {
              repositories: {
                include: {
                  skillRepository: true
                }
              }
            }
          }
        }
      }
    }
  });
  if (!sync || sync.status !== 'processing') return;

  let allRepositoryLinks =
    sync.destination.skillMarketplace?.repositories ??
    sync.destination.skillPlugin?.repositories ??
    [];
  let repositoryLinks = data.skillRepositoryId
    ? allRepositoryLinks.filter(link => link.skillRepository.id === data.skillRepositoryId)
    : allRepositoryLinks;

  await db.skillDestinationSync.update({
    where: { oid: sync.oid },
    data: { isAtRepoSyncStage: true }
  });
  await appendSkillDestinationSyncLog(
    data.skillDestinationSyncId,
    'Preparing repository updates.'
  );

  if (repositoryLinks.length === 0) {
    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      'No repository updates are configured.'
    );
    await syncFinishQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId
    });
    return;
  }

  let target = sync.destination.skillMarketplace ? 'marketplace' : 'skill';
  let propagationIds: string[] = [];

  for (let link of repositoryLinks) {
    let propagation = await withTransaction(async db => {
      let existing = await db.skillDestinationSyncRepositoryPropagation.findUnique({
        where: {
          skillDestinationSyncOid_skillRepositoryOid: {
            skillDestinationSyncOid: sync.oid,
            skillRepositoryOid: link.skillRepository.oid
          }
        }
      });
      if (existing) return existing;

      let repository = await db.skillRepository.update({
        where: { oid: link.skillRepository.oid },
        data: { syncCounter: { increment: 1 } }
      });

      return await db.skillDestinationSyncRepositoryPropagation.create({
        data: {
          ...getId('skillDestinationSyncRepositoryPropagation'),
          status: 'pending',
          skillDestinationSyncOid: sync.oid,
          skillRepositoryOid: link.skillRepository.oid,
          branchName: `metorial/sync-${target}-${repository.syncCounter}-${generatePlainId(4).toLowerCase()}`,
          prName: sync.prName ?? `Sync ${target}`,
          prDescription: sync.prDescription,
          commitMessage: sync.commitMessage ?? sync.prName ?? `Sync ${target}`
        }
      });
    });

    propagationIds.push(propagation.id);
  }

  await syncPropagatePerformQueue.add({
    skillDestinationSyncId: data.skillDestinationSyncId,
    processedPropagationIds: [],
    pendingPropagationIds: propagationIds
  });
});

export let syncPropagatePerformQueue = createQueue<{
  skillDestinationSyncId: string;
  processedPropagationIds: string[];
  pendingPropagationIds: string[];
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/propagate/perform',
  workerOpts: {
    concurrency: 10
  }
});

export let syncPropagatePerformQueueProcessor = syncPropagatePerformQueue.process(
  async data => {
    let sync = await db.skillDestinationSync.findUnique({
      where: { id: data.skillDestinationSyncId },
      include: {
        destination: true
      }
    });
    if (!sync || sync.status !== 'processing') return;

    let currentPropagationId = data.pendingPropagationIds[0];
    if (!currentPropagationId) {
      await syncPropagateWaitQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        pendingPropagationIds: data.processedPropagationIds
      });
      return;
    }

    try {
      let propagation = await db.skillDestinationSyncRepositoryPropagation.findFirst({
        where: {
          id: currentPropagationId,
          skillDestinationSyncOid: sync.oid
        },
        include: {
          skillRepository: true
        }
      });
      if (!propagation) throw new QueueRetryError();

      if (!propagation.originSyncId) {
        let originTenant = await getOriginTenant({
          oid: propagation.skillRepository.tenantOid,
          id: sync.destination.id
        });
        let originRepositories = await origin.scmRepository.getMany({
          tenantId: originTenant.id,
          scmRepositoryIds: [propagation.skillRepository.repoId]
        });
        let repositoryName = formatRepositoryName(originRepositories.repositories[0]);

        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `Starting update for ${repositoryName}.`
        );

        let originSync = await origin.scmRepository.syncCodeBucketToBranch({
          tenantId: originTenant.id,
          scmRepositoryId: propagation.skillRepository.repoId,
          codeBucketId: sync.destination.codeBucketId,
          branchName: propagation.branchName,
          prName: propagation.prName,
          prDescription: propagation.prDescription ?? undefined,
          enableAutoMerge: true
        });

        await db.skillDestinationSyncRepositoryPropagation.update({
          where: { oid: propagation.oid },
          data: {
            status: 'processing',
            startedAt: propagation.startedAt ?? new Date(),
            originSyncId: originSync.id
          }
        });
      } else if (propagation.status === 'pending') {
        await db.skillDestinationSyncRepositoryPropagation.update({
          where: { oid: propagation.oid },
          data: {
            status: 'processing',
            startedAt: propagation.startedAt ?? new Date()
          }
        });
      }
    } catch (e) {
      let errorMessage = await failSync({
        skillDestinationSyncId: data.skillDestinationSyncId,
        error: e
      });

      await db.skillDestinationSyncRepositoryPropagation.updateMany({
        where: { id: currentPropagationId },
        data: {
          status: 'failed',
          errorMessage,
          completedAt: new Date()
        }
      });
      return;
    }

    let newProcessedPropagationIds = [...data.processedPropagationIds, currentPropagationId];
    let newPendingPropagationIds = data.pendingPropagationIds.slice(1);

    if (newPendingPropagationIds.length === 0) {
      await syncPropagateWaitQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        pendingPropagationIds: newProcessedPropagationIds
      });
    } else {
      await syncPropagatePerformQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        processedPropagationIds: newProcessedPropagationIds,
        pendingPropagationIds: newPendingPropagationIds
      });
    }
  }
);

export let syncPropagateWaitQueue = createQueue<{
  skillDestinationSyncId: string;
  pendingPropagationIds: string[];
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/propagate/wait',
  workerOpts: {
    concurrency: 10
  }
});

export let syncPropagateWaitQueueProcessor = syncPropagateWaitQueue.process(async data => {
  let sync = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId },
    include: {
      destination: true
    }
  });
  if (!sync || sync.status !== 'processing') return;

  let propagations = await db.skillDestinationSyncRepositoryPropagation.findMany({
    where: {
      id: { in: data.pendingPropagationIds },
      skillDestinationSyncOid: sync.oid
    },
    include: {
      skillRepository: true
    }
  });

  let originSyncIds = propagations.flatMap(propagation =>
    propagation.originSyncId ? [propagation.originSyncId] : []
  );

  if (originSyncIds.length === 0) {
    await syncFinishQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId
    });
    return;
  }

  let originTenant = await getOriginTenant({
    oid: propagations[0]!.skillRepository.tenantOid,
    id: sync.destination.id
  });

  let originSyncs = await origin.scmRepositorySync.getMany({
    tenantId: originTenant.id,
    scmRepositorySyncIds: originSyncIds
  });
  let originSyncById = new Map(
    originSyncs.syncs.map(originSync => [originSync.id, originSync])
  );
  let originRepositories = await origin.scmRepository.getMany({
    tenantId: originTenant.id,
    scmRepositoryIds: propagations.map(propagation => propagation.skillRepository.repoId)
  });
  let originRepositoryById = new Map(
    originRepositories.repositories.map(repository => [repository.id, repository])
  );

  let pendingPropagationIds: string[] = [];
  let copiedLogs: SkillDestinationSyncLogEntry[] = [];
  let failed = false;

  for (let propagation of propagations) {
    if (!propagation.originSyncId) {
      pendingPropagationIds.push(propagation.id);
      continue;
    }

    let originSync = originSyncById.get(propagation.originSyncId);
    if (!originSync) {
      pendingPropagationIds.push(propagation.id);
      continue;
    }

    let repositoryName = formatRepositoryName(
      originRepositoryById.get(propagation.skillRepository.repoId)
    );
    copiedLogs.push(...normalizeOriginLogs(originSync.logs, repositoryName));

    if (
      originSync.status === 'merged' ||
      originSync.status === 'complete_unmerged' ||
      originSync.status === 'complete_no_changes'
    ) {
      await db.skillDestinationSyncRepositoryPropagation.update({
        where: { oid: propagation.oid },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Repository update completed for ${repositoryName}.`
      );
      continue;
    }

    if (originSync.status === 'failed' || originSync.status === 'cancelled') {
      failed = true;
      await db.skillDestinationSyncRepositoryPropagation.update({
        where: { oid: propagation.oid },
        data: {
          status: 'failed',
          errorMessage: originSync.errorMessage ?? `Origin sync ${originSync.status}`,
          completedAt: new Date()
        }
      });
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Repository update failed for ${repositoryName}.`
      );
      continue;
    }

    pendingPropagationIds.push(propagation.id);
  }

  await appendSkillDestinationSyncLogs({
    skillDestinationSyncId: data.skillDestinationSyncId,
    logs: copiedLogs
  });

  if (failed) {
    await db.skillDestinationSync.updateMany({
      where: { oid: sync.oid, status: 'processing' },
      data: {
        status: 'failed',
        completedAt: new Date()
      }
    });
    return;
  }

  if (pendingPropagationIds.length === 0) {
    await syncFinishQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId
    });
  } else {
    await syncPropagateWaitQueue.add(
      {
        skillDestinationSyncId: data.skillDestinationSyncId,
        pendingPropagationIds
      },
      { delay: 60_000 }
    );
  }
});
