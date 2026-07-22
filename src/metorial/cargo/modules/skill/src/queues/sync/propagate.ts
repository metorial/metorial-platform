import { generatePlainId } from '@lowerdeck/id';
import { getId } from '@metorial/cargo-config/id';
import { db, withTransaction } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getOriginTenant, origin } from '../../internal/skillDestination';
import {
  getRepositorySyncRetryMessage,
  isRepositorySyncRetrying
} from '../../lib/repositorySyncStatus';
import { createSkillSyncBranchName, normalizeSkillSyncBranchName } from './_lib/branchName';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import { syncFinishQueue } from './finish';

let getPublicErrorMessage = (error: unknown) => {
  let dataMessage = (error as any)?.data?.message;
  let message =
    typeof dataMessage === 'string'
      ? dataMessage
      : error instanceof Error
        ? error.message
        : String(error);
  let serialized = message.match(/\s+\((\{.*\})\)\s*$/s)?.[1];
  if (serialized) {
    try {
      let parsed = JSON.parse(serialized);
      if (typeof parsed?.message === 'string') message = parsed.message;
    } catch {
      // Leave non-lowerdeck metadata intact.
    }
  }

  return message.replace(/^\[@lowerdeck\/error\]:\s*/, '').trim();
};

let failSync = async (d: { skillDestinationSyncId: string; error: unknown }) => {
  let errorMessage = getPublicErrorMessage(d.error);

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

export let syncPropagateStartQueue = createQueue<{
  skillDestinationSyncId: string;
  skillRepositoryId?: string;
}>({
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
  let repositoryAccessMode =
    sync.destination.skillMarketplace?.repositoryAccessMode ?? 'pull_request';
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
          repositoryAccessMode,
          skillDestinationSyncOid: sync.oid,
          skillRepositoryOid: link.skillRepository.oid,
          branchName: createSkillSyncBranchName({
            target,
            syncCounter: repository.syncCounter,
            suffix: generatePlainId(4)
          }),
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
        let normalizedBranchName =
          propagation.repositoryAccessMode === 'pull_request'
            ? normalizeSkillSyncBranchName(propagation.branchName)
            : propagation.branchName;
        if (
          propagation.repositoryAccessMode === 'pull_request' &&
          normalizedBranchName !== propagation.branchName
        ) {
          propagation = await db.skillDestinationSyncRepositoryPropagation.update({
            where: { oid: propagation.oid },
            data: { branchName: normalizedBranchName },
            include: { skillRepository: true }
          });
        }

        let originTenant = await getOriginTenant({
          oid: propagation.skillRepository.resourceTenantOid,
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

        let originSync = await origin.scmRepository.syncCodeBucket({
          tenantId: originTenant.id,
          scmRepositoryId: propagation.skillRepository.repoId,
          codeBucketId: sync.destination.codeBucketId,
          repositoryAccessMode: propagation.repositoryAccessMode,
          requestKey: propagation.id,
          branchName:
            propagation.repositoryAccessMode === 'pull_request'
              ? propagation.branchName
              : undefined,
          prName:
            propagation.repositoryAccessMode === 'pull_request'
              ? propagation.prName
              : undefined,
          prDescription: propagation.prDescription ?? undefined,
          commitMessage: propagation.commitMessage ?? propagation.prName,
          enableAutoMerge:
            propagation.repositoryAccessMode === 'pull_request' ? true : undefined
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
  if (!sync || !['processing', 'waiting_for_review'].includes(sync.status)) return;

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
    oid: propagations[0]!.skillRepository.resourceTenantOid,
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

  for (let propagation of propagations) {
    if (!propagation.originSyncId) continue;

    let originSync = originSyncById.get(propagation.originSyncId);
    if (!originSync) continue;

    let repositoryName = formatRepositoryName(
      originRepositoryById.get(propagation.skillRepository.repoId)
    );
    if (
      originSync.status === 'merged' ||
      originSync.status === 'complete_unmerged' ||
      originSync.status === 'complete_direct_push' ||
      originSync.status === 'complete_no_changes'
    ) {
      let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
        where: {
          oid: propagation.oid,
          status: { in: ['processing', 'waiting_for_review'] }
        },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });
      if (updated.count > 0) {
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `Repository update completed for ${repositoryName}.`
        );
      }
      continue;
    }

    if (originSync.status === 'failed') {
      let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
        where: {
          oid: propagation.oid,
          status: { in: ['processing', 'waiting_for_review'] }
        },
        data: {
          status: 'failed',
          errorMessage: originSync.errorMessage ?? `Origin sync ${originSync.status}`,
          completedAt: new Date()
        }
      });
      if (updated.count > 0) {
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `${repositoryName}: ${originSync.errorMessage ?? 'Repository update failed.'}`
        );
      }
      continue;
    }

    if (originSync.status === 'cancelled') {
      let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
        where: {
          oid: propagation.oid,
          status: { in: ['processing', 'waiting_for_review'] }
        },
        data: {
          status: 'canceled',
          errorMessage: originSync.errorMessage,
          completedAt: new Date()
        }
      });
      if (updated.count > 0) {
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `Repository update canceled for ${repositoryName}.`
        );
      }
      continue;
    }

    let nextStatus =
      propagation.repositoryAccessMode === 'pull_request' &&
      originSync.status === 'waiting_for_review'
        ? ('waiting_for_review' as const)
        : ('processing' as const);
    let providerUnavailable = isRepositorySyncRetrying(originSync);
    let nextErrorMessage = providerUnavailable
      ? getRepositorySyncRetryMessage(propagation.repositoryAccessMode)
      : null;
    if (propagation.status !== nextStatus || propagation.errorMessage !== nextErrorMessage) {
      let updated = await db.skillDestinationSyncRepositoryPropagation.updateMany({
        where: {
          oid: propagation.oid,
          status: propagation.status,
          errorMessage: propagation.errorMessage
        },
        data: {
          status: nextStatus,
          errorMessage: nextErrorMessage
        }
      });
      if (updated.count === 0) continue;

      console.log(
        JSON.stringify({
          event: 'cargo_skill_repository_sync_reconciled',
          level: providerUnavailable ? 'warn' : 'info',
          skillDestinationSyncId: data.skillDestinationSyncId,
          propagationId: propagation.id,
          repository: repositoryName,
          provider: originRepositoryById.get(propagation.skillRepository.repoId)?.provider,
          originSyncId: originSync.id,
          originStatus: originSync.status,
          previousStatus: propagation.status,
          status: nextStatus,
          originError: originSync.errorMessage
        })
      );

      if (providerUnavailable) {
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `${repositoryName}: ${nextErrorMessage}`
        );
      } else if (propagation.errorMessage) {
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `${repositoryName}: Repository status is available again.`
        );
      } else if (nextStatus === 'waiting_for_review') {
        let snapshot = originSync.statusSnapshot as
          | {
              checks?: {
                state?: string;
                items?: { name?: string; status?: string }[];
              };
              review?: { state?: string };
              mergeability?: { state?: string; reason?: string };
            }
          | null
          | undefined;
        let checksFailed = snapshot?.checks?.state === 'failed';
        let failedChecks = (snapshot?.checks?.items ?? [])
          .filter(check => check.status === 'failed')
          .flatMap(check => (check.name ? [check.name] : []))
          .slice(0, 3);
        let reviewRequired = ['pending', 'changes_requested'].includes(
          snapshot?.review?.state ?? ''
        );
        let hasConflict = snapshot?.mergeability?.state === 'conflicting';
        let mergePermissionRequired =
          snapshot?.mergeability?.reason === 'merge_permission_required';
        let failedChecksMessage = failedChecks.length
          ? `Checks failed: ${failedChecks.join(', ')}.`
          : 'Repository checks failed.';
        let message =
          checksFailed && reviewRequired
            ? `${failedChecksMessage} Review is required.`
            : checksFailed
              ? failedChecksMessage
              : mergePermissionRequired
                ? 'The connected GitLab user does not have permission to merge.'
                : hasConflict
                  ? 'Pull request has merge conflicts.'
                  : reviewRequired
                    ? snapshot?.review?.state === 'changes_requested'
                      ? 'Review changes were requested.'
                      : 'Review required.'
                    : 'Repository action required.';
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `${repositoryName}: ${message}`
        );
      } else {
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `${repositoryName}: Repository requirements changed; continuing sync.`
        );
      }
    }
  }

  let allPropagations = await db.skillDestinationSyncRepositoryPropagation.findMany({
    where: { skillDestinationSyncOid: sync.oid },
    select: { status: true }
  });
  if (allPropagations.some(propagation => propagation.status === 'failed')) {
    await db.skillDestinationSync.updateMany({
      where: {
        oid: sync.oid,
        status: { in: ['processing', 'waiting_for_review'] }
      },
      data: {
        status: 'failed',
        completedAt: new Date()
      }
    });
    return;
  }

  if (
    allPropagations.length > 0 &&
    allPropagations.every(propagation => propagation.status === 'completed')
  ) {
    await syncFinishQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId
    });
    return;
  }

  if (
    allPropagations.length > 0 &&
    allPropagations.every(propagation =>
      ['completed', 'canceled'].includes(propagation.status)
    )
  ) {
    await syncFinishQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId,
      status: 'canceled'
    });
    return;
  }

  let status = allPropagations.some(propagation => propagation.status === 'waiting_for_review')
    ? ('waiting_for_review' as const)
    : ('processing' as const);
  await db.skillDestinationSync.updateMany({
    where: {
      oid: sync.oid,
      status: { in: ['processing', 'waiting_for_review'] }
    },
    data: { status }
  });
});
