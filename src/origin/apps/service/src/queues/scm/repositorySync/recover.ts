import { createCron } from '@lowerdeck/cron';
import { db } from '../../../db';
import { env } from '../../../env';
import { createBranchRepositorySyncQueue } from './createBranch';
import { createPrRepositorySyncQueue } from './createPr';
import { mergeRepositorySyncQueue } from './merge';
import { startRepositorySyncQueue } from './start';
import { syncContentsRepositorySyncQueue } from './syncContents';
import { waitForCiRepositorySyncQueue } from './waitForCi';

export let recoverRepositorySyncProcessor = createCron(
  {
    name: 'ori/rep-sync/recover',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let now = new Date();
    let stale = new Date(now.getTime() - 5 * 60_000);
    let syncs = await db.scmRepositorySync.findMany({
      where: {
        OR: [
          {
            status: { in: ['waiting_for_ci', 'waiting_for_review'] },
            OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }]
          },
          {
            status: {
              in: ['pending', 'creating_branch', 'syncing_contents', 'creating_pr', 'merging']
            },
            updatedAt: { lte: stale }
          }
        ]
      },
      select: { id: true, status: true },
      orderBy: { updatedAt: 'asc' },
      take: 500
    });

    let bucket = Math.floor(now.getTime() / 60_000);
    for (let sync of syncs) {
      let options = { id: `${sync.id}:recovery:${sync.status}:${bucket}` };
      if (sync.status === 'pending') await startRepositorySyncQueue.add({ syncId: sync.id }, options);
      else if (sync.status === 'creating_branch')
        await createBranchRepositorySyncQueue.add({ syncId: sync.id }, options);
      else if (sync.status === 'syncing_contents')
        await syncContentsRepositorySyncQueue.add({ syncId: sync.id }, options);
      else if (sync.status === 'creating_pr')
        await createPrRepositorySyncQueue.add({ syncId: sync.id }, options);
      else if (sync.status === 'merging')
        await mergeRepositorySyncQueue.add({ syncId: sync.id }, options);
      else await waitForCiRepositorySyncQueue.add({ syncId: sync.id }, options);
    }
  }
);

export let accelerateRepositorySyncsForProviderEvent = async (d: {
  repoOid: bigint;
  providerPrId?: string;
  idempotencyKey: string;
}) => {
  let syncs = await db.scmRepositorySync.findMany({
    where: {
      repoOid: d.repoOid,
      status: { in: ['waiting_for_ci', 'waiting_for_review', 'merging'] },
      ...(d.providerPrId && { providerPrId: d.providerPrId })
    },
    select: { id: true, status: true }
  });
  for (let sync of syncs) {
    if (sync.status === 'merging') {
      await mergeRepositorySyncQueue.add(
        { syncId: sync.id },
        { id: `${sync.id}:webhook:${d.idempotencyKey}` }
      );
    } else {
      await waitForCiRepositorySyncQueue.add(
        { syncId: sync.id },
        { id: `${sync.id}:webhook:${d.idempotencyKey}` }
      );
    }
  }
};
