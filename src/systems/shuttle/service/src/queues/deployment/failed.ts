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
  let deployment = await db.serverDeployment.update({
    where: { id: data.serverDeploymentId },
    data: {
      status: 'failed',
      endedAt: new Date()
    }
  });

  await db.serverDeploymentStep.updateMany({
    where: {
      deploymentOid: deployment.oid,
      status: { in: ['running'] }
    },
    data: {
      status: 'failed',
      endedAt: deployment.endedAt
    }
  });
});
