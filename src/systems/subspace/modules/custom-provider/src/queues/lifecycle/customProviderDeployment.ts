import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { ensureEnvironments } from '../../internal/ensureEnvironments';
import { customDeploymentMonitorQueue } from '../deployment/monitor';

export let customProviderDeploymentCreatedQueue = createQueue<{
  customProviderDeploymentId: string;
}>({
  name: 'sub/cpr/lc/customProviderDeployment/created',
  redisUrl: env.service.REDIS_URL
});

export let customProviderDeploymentCreatedQueueProcessor =
  customProviderDeploymentCreatedQueue.process(async data => {
    let deployment = await db.customProviderDeployment.findFirst({
      where: { id: data.customProviderDeploymentId },
      include: { customProvider: true }
    });
    if (!deployment) throw new QueueRetryError();

    await ensureEnvironments(deployment);

    await customDeploymentMonitorQueue.add({
      customProviderDeploymentId: data.customProviderDeploymentId
    });
  });
