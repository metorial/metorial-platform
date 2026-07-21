import { createCron } from '@lowerdeck/cron';
import { db } from '../../db';
import { env } from '../../env';
import { createRepoWebhookQueue } from './createRepoWebhook';

export let reconcileRepoWebhooksProcessor = createCron(
  {
    name: 'ori/rep/wh-reconcile',
    cron: '17 */6 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let bucket = Math.floor(Date.now() / (6 * 60 * 60_000));
    let cursor: bigint | undefined;
    while (true) {
      let repos = await db.scmRepository.findMany({
        where: cursor == null ? undefined : { oid: { gt: cursor } },
        select: { oid: true, id: true },
        orderBy: { oid: 'asc' },
        take: 1_000
      });
      for (let repo of repos) {
        await createRepoWebhookQueue.add(
          { repoId: repo.id },
          { id: `${repo.id}:reconcile:${bucket}` }
        );
      }
      if (repos.length < 1_000) return;
      cursor = repos[repos.length - 1]!.oid;
    }
  }
);
