import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { getRepositorySyncCiState } from '../../../lib/scmRepositorySyncProvider';
import { markRepositorySyncFailed } from './_lib';
import { mergeRepositorySyncQueue } from './merge';

export let waitForCiRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/wait-ci',
  redisUrl: env.service.REDIS_URL
});

export let waitForCiRepositorySyncQueueProcessor = waitForCiRepositorySyncQueue.process(async data => {
  try {
    let sync = await db.scmRepositorySync.findFirst({
      where: {
        id: data.syncId,
        status: 'waiting_for_ci'
      },
      include: {
        repo: {
          include: {
            installation: {
              include: {
                backend: true
              }
            }
          }
        }
      }
    });

    if (!sync) return;

    let ciState = await getRepositorySyncCiState(sync);
    let now = new Date();

    if (ciState === 'pending') {
      let nextPollAt = new Date(now.getTime() + 60_000);

      await db.scmRepositorySync.update({
        where: { oid: sync.oid },
        data: {
          ciState,
          lastPolledAt: now,
          nextPollAt
        }
      });

      await waitForCiRepositorySyncQueue.add({ syncId: data.syncId }, { delay: 60_000 });
      return;
    }

    if (ciState === 'failed') {
      await db.scmRepositorySync.update({
        where: { oid: sync.oid },
        data: {
          status: 'failed',
          ciState,
          lastPolledAt: now,
          completedAt: now,
          errorMessage: 'Repository checks failed'
        }
      });
      return;
    }

    await db.scmRepositorySync.update({
      where: { oid: sync.oid },
      data: {
        status: 'merging',
        ciState,
        lastPolledAt: now,
        nextPollAt: null
      }
    });

    await mergeRepositorySyncQueue.add({ syncId: data.syncId });
  } catch (e) {
    await markRepositorySyncFailed(data.syncId, e);
  }
});
