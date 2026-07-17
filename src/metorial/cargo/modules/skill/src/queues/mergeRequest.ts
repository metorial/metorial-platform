import { createCron } from '@metorial/cron';
import type { SkillVersion } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import {
  createSkillMergeRequestMergeError,
  toSkillMergeRequestMergeError
} from '../lib/mergeError';
import { skillMergeTargetLock } from '../lib/mergeLock';
import { skillMergeRequestApplyInternalService } from '../services/skillMergeRequestApplyInternal';
import { skillMergeRequestEventService } from '../services/skillMergeRequestEvent';
import {
  skillMergeRequestInclude,
  skillMergeRequestInternalService,
  skillMergeRequestItemInclude
} from '../services/skillMergeRequestInternal';
export let skillMergeRequestPerformQueue = createQueue<{
  skillMergeRequestId: string;
}>({
  name: 'cargo/skill/merge-request/perform',
  workerOpts: {
    concurrency: 5
  }
});

export let enqueueSkillMergeRequestPerform = async (d: { skillMergeRequestId: string }) => {
  await skillMergeRequestPerformQueue.add(d, {
    id: `skillMergeRequest:perform:${d.skillMergeRequestId}`
  });
};

export let processSkillMergeRequestPerformJob = async (d: { skillMergeRequestId: string }) => {
  let mergeRequest = await db.skillMergeRequest.findFirst({
    where: {
      id: d.skillMergeRequestId
    },
    include: skillMergeRequestInclude
  });

  if (!mergeRequest || mergeRequest.status !== 'merging') return null;

  return await skillMergeTargetLock.usingLock(mergeRequest.targetSkill.store!.id, async () => {
    mergeRequest = await db.skillMergeRequest.findFirst({
      where: {
        id: d.skillMergeRequestId
      },
      include: skillMergeRequestInclude
    });
    if (!mergeRequest || mergeRequest.status !== 'merging') return null;
    let activeMergeRequest = mergeRequest;

    try {
      let freshTargetVersion =
        await skillMergeRequestInternalService.flushSkillForMergeSnapshot({
          skill: mergeRequest.targetSkill
        });
      let freshTarget = await skillMergeRequestInternalService.getSkillVersionSnapshot(
        freshTargetVersion.oid
      );

      await skillMergeRequestInternalService.reconcileMergeRequestWithTarget({
        mergeRequest,
        targetSkillVersionOid: freshTargetVersion.oid
      });

      let items = await db.skillMergeRequestItem.findMany({
        where: {
          skillMergeRequestOid: mergeRequest.oid,
          status: {
            in: ['resolved', 'skipped']
          }
        },
        include: skillMergeRequestItemInclude,
        orderBy: {
          path: 'asc'
        }
      });
      let unresolvedCount = await db.skillMergeRequestItem.count({
        where: {
          skillMergeRequestOid: mergeRequest.oid,
          status: 'unresolved'
        }
      });

      if (unresolvedCount > 0) {
        throw createSkillMergeRequestMergeError('unresolved_after_refresh');
      }

      let mergeActorId = mergeRequest.mergeStartedByResourceActor?.id;

      if (!mergeRequest.preMergeTargetSkillVersionOid) {
        await db.skillMergeRequest.update({
          where: {
            id: mergeRequest.id
          },
          data: {
            preMergeTargetSkillVersionOid: freshTargetVersion.oid
          }
        });
      }

      let resourceTenant = await db.resourceTenant.findUniqueOrThrow({
        where: { oid: mergeRequest.resourceTenantOid }
      });
      let resourceGroup = await db.resourceGroup.findUniqueOrThrow({
        where: { oid: mergeRequest.resourceGroupOid }
      });

      await skillMergeRequestApplyInternalService.applyResolvedItems({
        resourceTenant,
        resourceGroup,
        mergeRequest,
        items,
        actorId: mergeActorId
      });

      let mergedTargetVersion =
        await skillMergeRequestInternalService.flushSkillForMergeSnapshot({
          skill: mergeRequest.targetSkill
        });
      let mergedTarget = await skillMergeRequestInternalService.getSkillVersionSnapshot(
        mergedTargetVersion.oid
      );

      await skillMergeRequestApplyInternalService.verifyResolvedItems({
        items,
        before: freshTarget,
        target: mergedTarget
      });

      return await withTransaction(async tx => {
        await tx.skillMergeRequestItem.updateMany({
          where: {
            skillMergeRequestOid: activeMergeRequest.oid,
            status: 'resolved'
          },
          data: {
            status: 'applied',
            appliedAt: new Date()
          }
        });

        let merged = await tx.skillMergeRequest.update({
          where: {
            id: activeMergeRequest.id
          },
          data: {
            status: 'merged',
            mergeError: null,
            mergeErrorCode: null,
            mergedAt: new Date(),
            mergedByResourceActorOid: activeMergeRequest.mergeStartedByResourceActorOid,
            mergedTargetSkillVersionOid: mergedTargetVersion.oid,
            activePairKey: null
          },
          include: skillMergeRequestInclude
        });
        await tx.skillForkSync.updateMany({
          where: {
            generatedMergeRequestOid: activeMergeRequest.oid,
            status: {
              in: ['pending', 'processing', 'action_required']
            }
          },
          data: {
            status: 'completed',
            activePairKey: null,
            error: null,
            completedAt: new Date()
          }
        });
        await skillMergeRequestEventService.createEvent({
          database: tx,
          mergeRequestOid: activeMergeRequest.oid,
          type: 'merge_completed',
          actorOid: activeMergeRequest.mergeStartedByResourceActorOid
        });
        return merged;
      });
    } catch (err) {
      let mergeError = toSkillMergeRequestMergeError(err, 'apply_failed');
      let resumedTargetVersion: SkillVersion | undefined;

      try {
        resumedTargetVersion =
          await skillMergeRequestInternalService.flushSkillForMergeSnapshot({
            skill: activeMergeRequest.targetSkill
          });
        await skillMergeRequestInternalService.reconcileMergeRequestWithTarget({
          mergeRequest: activeMergeRequest,
          targetSkillVersionOid: resumedTargetVersion.oid
        });
      } catch {
        // Preserve the original merge error. Recovery can be retried by the stale-merge processor.
      }

      await withTransaction(async tx => {
        await tx.skillMergeRequest.update({
          where: {
            id: activeMergeRequest.id
          },
          data: {
            status: 'open',
            mergeError: mergeError.message,
            mergeErrorCode: mergeError.code,
            mergeStartedAt: null,
            requestedTargetSkillVersionOid: resumedTargetVersion?.oid
          }
        });
        await tx.skillForkSync.updateMany({
          where: {
            generatedMergeRequestOid: activeMergeRequest.oid,
            status: {
              in: ['pending', 'processing', 'action_required']
            }
          },
          data: {
            status: 'action_required',
            error: mergeError.message,
            actionRequiredAt: new Date()
          }
        });
        await skillMergeRequestEventService.createEvent({
          database: tx,
          mergeRequestOid: activeMergeRequest.oid,
          type: 'merge_failed',
          errorCode: mergeError.code,
          errorMessage: mergeError.message
        });
      });

      throw mergeError;
    }
  });
};

export let skillMergeRequestPerformQueueProcessor = skillMergeRequestPerformQueue.process(
  async data => {
    await processSkillMergeRequestPerformJob(data);
  }
);

export let recoverStaleSkillMergeRequests = async () => {
  let staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  let staleRequests = await db.skillMergeRequest.findMany({
    where: {
      status: 'merging',
      mergeStartedAt: {
        lt: staleBefore
      }
    },
    select: {
      id: true,
      oid: true,
      targetSkill: {
        select: {
          store: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  for (let mergeRequest of staleRequests) {
    await skillMergeTargetLock.usingLock(mergeRequest.targetSkill.store!.id, async () => {
      let mergeError = createSkillMergeRequestMergeError('stale_merge_recovered');
      await withTransaction(async tx => {
        let recovered = await tx.skillMergeRequest.updateMany({
          where: {
            id: mergeRequest.id,
            status: 'merging',
            mergeStartedAt: {
              lt: staleBefore
            }
          },
          data: {
            status: 'open',
            mergeStartedAt: null,
            mergeErrorCode: mergeError.code,
            mergeError: mergeError.message
          }
        });
        if (recovered.count !== 1) return;

        await tx.skillForkSync.updateMany({
          where: {
            generatedMergeRequest: {
              id: mergeRequest.id
            },
            status: 'processing'
          },
          data: {
            status: 'action_required',
            error: mergeError.message,
            actionRequiredAt: new Date()
          }
        });
        await skillMergeRequestEventService.createEvent({
          database: tx,
          mergeRequestOid: mergeRequest.oid,
          type: 'merge_failed',
          errorCode: mergeError.code,
          errorMessage: mergeError.message
        });
      });
    });
  }
};

export let skillMergeRequestRecoveryCron = createCron(
  {
    name: 'cargo/skill/merge-request/recovery/cron',
    cron: '*/5 * * * *'
  },
  recoverStaleSkillMergeRequests
);
