import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { codeBucketService } from '../../services';

export let createHandleRepoPushQueue = createQueue<{ pushId: string }>({
  name: 'ori/rep/hndl-push',
  redisUrl: env.service.REDIS_URL
});

export let createHandleRepoPushQueueProcessor = createHandleRepoPushQueue.process(
  async data => {
    let push = await db.scmRepositoryPush.findUnique({
      where: { id: data.pushId },
      include: { repo: true }
    });
    if (!push) throw new QueueRetryError();

    // Create change notification
    let tenant = await db.tenant.findUniqueOrThrow({
      where: { oid: push.tenantOid }
    });

    // Sync all synced buckets for this repo and branch
    let syncedBuckets = await db.codeBucket.findMany({
      where: {
        repositoryOid: push.repo.oid,
        isSynced: true,
        syncRef: push.branchName
      }
    });

    for (let bucket of syncedBuckets) {
      await codeBucketService.syncCodeBucketFromRepo({
        codeBucket: bucket,
        repo: push.repo
      });
    }

    await db.changeNotification.create({
      data: {
        ...getId('changeNotification'),
        type: 'repo_push',
        tenantOid: tenant.oid,
        repoOid: push.repo.oid,
        repoPushOid: push.oid
      }
    });
  }
);
