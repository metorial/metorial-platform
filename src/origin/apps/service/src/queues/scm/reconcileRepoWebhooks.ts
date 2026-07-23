import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { createRepoWebhookQueue } from './createRepoWebhook';

export let reconcileRepoWebhooksPageSize = 250;

export let reconcileRepoWebhooksManyQueue = createQueue<{
  cursor?: string;
  runId: string;
}>({
  name: 'ori/rep/wh-reconcile-many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let enqueueRepositoryWebhookReconcileRun = async () => {
  let runId = Math.floor(Date.now() / (60 * 60_000)).toString();
  await reconcileRepoWebhooksManyQueue.add(
    { runId },
    { id: `webhook-reconcile:${runId}:page-start` }
  );
};

export let reconcileRepoWebhooksCronProcessor = createCron(
  {
    name: 'ori/rep/wh-reconcile',
    cron: '17 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  enqueueRepositoryWebhookReconcileRun
);

export let enqueueRepositoryWebhookReconcilePage = async (data: {
  cursor?: string;
  runId: string;
}) => {
  let now = new Date();
  let repos = await db.scmRepository.findMany({
    where: {
      ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {}),
      OR: [
        { webhookReconcileBlockedUntil: null },
        { webhookReconcileBlockedUntil: { lte: now } }
      ]
    },
    select: { oid: true, id: true },
    orderBy: { oid: 'asc' },
    take: reconcileRepoWebhooksPageSize
  });
  if (!repos.length) return;

  await createRepoWebhookQueue.addManyWithOps(
    repos.map(repo => ({
      data: { repoId: repo.id },
      opts: { id: `${repo.id}:reconcile:${data.runId}` }
    }))
  );

  if (repos.length === reconcileRepoWebhooksPageSize) {
    let cursor = repos[repos.length - 1]!.oid.toString();
    await reconcileRepoWebhooksManyQueue.add(
      { cursor, runId: data.runId },
      { id: `webhook-reconcile:${data.runId}:page:${cursor}` }
    );
  }
};

export let reconcileRepoWebhooksManyQueueProcessor = reconcileRepoWebhooksManyQueue.process(
  enqueueRepositoryWebhookReconcilePage
);

export let reconcileRepoWebhooksProcessor = combineQueueProcessors([
  reconcileRepoWebhooksCronProcessor,
  reconcileRepoWebhooksManyQueueProcessor
]);
