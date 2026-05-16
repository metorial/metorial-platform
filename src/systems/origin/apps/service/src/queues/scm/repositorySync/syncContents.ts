import { createQueue } from '@lowerdeck/queue';
import { db } from '../../../db';
import { env } from '../../../env';
import { codeBucketService } from '../../../services';
import { markRepositorySyncFailed } from './_lib';
import { createPrRepositorySyncQueue } from './createPr';

export let syncContentsRepositorySyncQueue = createQueue<{ syncId: string }>({
  name: 'ori/rep-sync/contents',
  redisUrl: env.service.REDIS_URL
});

export let syncContentsRepositorySyncQueueProcessor = syncContentsRepositorySyncQueue.process(
  async data => {
    try {
      let sync = await db.scmRepositorySync.findFirst({
        where: {
          id: data.syncId,
          status: 'syncing_contents'
        },
        include: {
          codeBucket: true,
          repo: true
        }
      });

      if (!sync) return;

      await codeBucketService.exportCodeBucketToRepoNow({
        codeBucket: sync.codeBucket,
        repo: sync.repo,
        path: sync.codeBucket.path ?? '/',
        branchName: sync.branchName,
        commitMessage: sync.title
      });

      await db.scmRepositorySync.update({
        where: { oid: sync.oid },
        data: {
          status: 'creating_pr'
        }
      });

      await createPrRepositorySyncQueue.add({ syncId: data.syncId });
    } catch (e) {
      await markRepositorySyncFailed(data.syncId, e);
    }
  }
);
