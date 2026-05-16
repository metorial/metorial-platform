import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, env, getId, withTransaction } from '@metorial-cargo/db';
import { getOriginTenant, origin } from '../../internal/skillDestination';
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

  return errorMessage;
};

export let syncPropagateStartQueue = createQueue<{
  skillDestinationSyncId: string;
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

  let repositoryLinks =
    sync.destination.skillMarketplace?.repositories ??
    sync.destination.skillPlugin?.repositories ??
    [];

  await db.skillDestinationSync.update({
    where: { oid: sync.oid },
    data: { isAtRepoSyncStage: true }
  });

  if (repositoryLinks.length === 0) {
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
          branchName: `metorial/sync-${target}-${repository.syncCounter}`,
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

  let pendingPropagationIds: string[] = [];
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
      continue;
    }

    pendingPropagationIds.push(propagation.id);
  }

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
