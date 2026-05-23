import { createQueue } from '@mtsrc/queue';
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
    let deployment = await db.serverDeployment.update({
      where: { id: data.serverDeploymentId },
      data: {
        status: 'succeeded',
        endedAt: new Date()
      }
    });

    await db.serverDeploymentStep.updateMany({
      where: {
        deploymentOid: deployment.oid,
        status: { in: ['running'] }
      },
      data: {
        status: 'succeeded',
        endedAt: deployment.endedAt
      }
    });
  }
);
