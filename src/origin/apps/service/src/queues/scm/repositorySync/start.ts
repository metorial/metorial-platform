import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { transitionRepositorySyncState } from '../../../services/repositorySyncState';
import {
  appendRepositorySyncLog,
  logRepositorySyncQueueError,
  logRepositorySyncQueueEvent,
  markRepositorySyncFailed
} from './_lib';
import { createBranchRepositorySyncQueue } from './createBranch';

export let startRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/start',
  redisUrl: env.service.REDIS_URL
});

export let startRepositorySyncQueueProcessor = startRepositorySyncQueue.process(async data => {
  try {
    logRepositorySyncQueueEvent('start', 'processing queue item', {
      syncId: data.syncId,
      expectedStatus: 'pending'
    });

    let existing = await db.scmRepositorySync.findFirst({
      where: {
        id: data.syncId,
        status: 'pending'
      }
    });

    if (!existing) {
      logRepositorySyncQueueEvent(
        'start',
        'skipped sync because expected status was not present',
        {
          syncId: data.syncId,
          expectedStatus: 'pending'
        }
      );
      return;
    }
    if (existing.repositoryAccessMode === 'default_branch') {
      let blockingDefaultBranchWrite = await db.scmRepositorySync.findFirst({
        where: {
          repoOid: existing.repoOid,
          id: { not: existing.id },
          OR: [
            {
              repositoryAccessMode: 'default_branch',
              oid: { lt: existing.oid },
              status: {
                notIn: [
                  'merged',
                  'failed',
                  'cancelled',
                  'complete_unmerged',
                  'complete_direct_push',
                  'complete_no_changes'
                ]
              }
            },
            { status: 'merging' }
          ]
        },
        select: { id: true }
      });
      if (blockingDefaultBranchWrite) {
        logRepositorySyncQueueEvent('start', 'waiting for earlier direct push', {
          syncId: existing.id,
          blockingSyncId: blockingDefaultBranchWrite.id
        });
        await startRepositorySyncQueue.add(
          { syncId: existing.id },
          { delay: 2_000 + Math.floor(Math.random() * 1_000) }
        );
        return;
      }
    }
    let updated = await transitionRepositorySyncState(data.syncId, 'pending', {
      status: 'creating_branch'
    });
    if (!updated) return;

    await appendRepositorySyncLog(data.syncId, 'Starting repository update.');

    logRepositorySyncQueueEvent('start', 'transitioned sync to creating_branch', {
      syncId: data.syncId
    });

    await createBranchRepositorySyncQueue.add({ syncId: data.syncId });
    logRepositorySyncQueueEvent('start', 'enqueued create branch stage', {
      syncId: data.syncId
    });
  } catch (e) {
    logRepositorySyncQueueError('start', 'failed while processing queue item', e, {
      syncId: data.syncId
    });
    await markRepositorySyncFailed(data.syncId, e);
  }
});
