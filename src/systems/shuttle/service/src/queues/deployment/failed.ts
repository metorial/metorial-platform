import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';

export let deployServerFailedQueue = createQueue<{
  serverDeploymentId: string;
}>({
  name: 'shut/deploy/failed',
  redisUrl: env.service.REDIS_URL
});

export let deployServerFailedQueueProcessor = deployServerFailedQueue.process(async data => {
  let deployment = await db.serverDeployment.findFirst({
    where: { id: data.serverDeploymentId },
    select: { oid: true }
  });
  if (!deployment) return;

  let endedAt = new Date();
  let update = await db.serverDeployment.updateMany({
    where: {
      id: data.serverDeploymentId,
      status: { in: ['queued', 'deploying'] }
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
