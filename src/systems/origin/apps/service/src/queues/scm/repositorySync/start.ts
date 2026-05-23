import { createQueue } from '@mtsrc/queue';
import { db } from '../../../db';
import { env } from '../../../env';
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

    let updated = await db.scmRepositorySync.updateMany({
      where: {
        id: data.syncId,
        status: 'pending'
      },
      data: {
        status: 'creating_branch'
      }
    });

    if (updated.count === 0) {
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
