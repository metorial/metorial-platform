import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';

let DEPLOYING_TIMEOUT_MS = 1000 * 60 * 15;
let QUEUED_TIMEOUT_MS = 1000 * 60 * 60 * 24;

let getTimeoutThresholds = () => {
  let now = Date.now();

  return {
    deploying: new Date(now - DEPLOYING_TIMEOUT_MS),
    queued: new Date(now - QUEUED_TIMEOUT_MS)
  };
};

export let deployServerTimeoutCron = createCron(
  {
    name: 'shut/deploy/timeout/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await deployServerTimeoutManyQueue.add({});
  }
);

export let deployServerTimeoutManyQueue = createQueue<{ cursor?: string }>({
  name: 'shut/deploy/timeout/many',
  redisUrl: env.service.REDIS_URL
});

export let deployServerTimeoutManyQueueProcessor =
  deployServerTimeoutManyQueue.process(async data => {
    let thresholds = getTimeoutThresholds();

    let deployments = await db.serverDeployment.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        OR: [
          {
            status: 'deploying',
            startedAt: { lte: thresholds.deploying }
          },
          {
            status: 'queued',
            createdAt: { lte: thresholds.queued }
          }
        ]
      },
      take: 100,
      orderBy: { id: 'asc' },
      select: { id: true }
    });
    if (deployments.length === 0) return;

    await deployServerTimeoutSingleQueue.addManyWithOps(
      deployments.map(deployment => ({
        data: { serverDeploymentId: deployment.id },
        opts: { id: deployment.id }
      }))
    );

    await deployServerTimeoutManyQueue.add({
      cursor: deployments[deployments.length - 1]!.id
    });
  });

export let deployServerTimeoutSingleQueue = createQueue<{
  serverDeploymentId: string;
}>({
  name: 'shut/deploy/timeout',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10
  }
});

export let deployServerTimeoutSingleQueueProcessor =
  deployServerTimeoutSingleQueue.process(async data => {
    let thresholds = getTimeoutThresholds();

    let deployment = await db.serverDeployment.findFirst({
      where: {
        id: data.serverDeploymentId,
        OR: [
          {
            status: 'deploying',
            startedAt: { lte: thresholds.deploying }
          },
          {
            status: 'queued',
            createdAt: { lte: thresholds.queued }
          }
        ]
      },
      select: { oid: true }
    });
    if (!deployment) return;

    let endedAt = new Date();
    let update = await db.serverDeployment.updateMany({
      where: {
        id: data.serverDeploymentId,
        OR: [
          {
            status: 'deploying',
            startedAt: { lte: thresholds.deploying }
          },
          {
            status: 'queued',
            createdAt: { lte: thresholds.queued }
          }
        ]
      },
      data: {
        status: 'failed',
        endedAt
      }
    });
    if (update.count === 0) return;

    await db.serverDeploymentStep.updateMany({
      where: {
        deploymentOid: deployment.oid,
        status: { in: ['running'] }
      },
      data: {
        status: 'failed',
        endedAt
      }
    });
  });
