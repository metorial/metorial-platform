import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';

export let deployServerSucceededQueue = createQueue<{
  serverDeploymentId: string;
}>({
  name: 'shut/deploy/succeeded',
  redisUrl: env.service.REDIS_URL
});

export let deployServerSucceededQueueProcessor = deployServerSucceededQueue.process(
  async data => {
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
        status: 'succeeded',
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
        status: 'succeeded',
        endedAt
      }
    });
  }
);
