import { createQueue } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import { functionBay } from '../../functionBay';
import { deployServerFailedQueue } from '../deployment/failed';
import { deployFunctionServerDiscoverQueue } from './discover';

export let deployFunctionServerWatchQueue = createQueue<{
  serverDeploymentId: string;
  functionServerId: string;

  functionBayTenantId: string;
  functionBayFunctionId: string;
  functionBayDeploymentId: string;

  deployingStepId: string;
}>({
  name: 'shut/func-ser/deploy/watch',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000
    }
  }
});

export let deployFunctionServerWatchQueueProcessor = deployFunctionServerWatchQueue.process(
  async data => {
    let func = await functionBay.functionDeployment.get({
      tenantId: data.functionBayTenantId,
      functionId: data.functionBayFunctionId,
      functionDeploymentId: data.functionBayDeploymentId
    });

    if (func.status == 'pending' || func.status == 'running') {
      await deployFunctionServerWatchQueue.add({ ...data }, { delay: 1000 });
      return;
    }

    await db.functionServer.update({
      where: { id: data.functionServerId },
      data: {
        functionBayVersionId: func.version?.id,
        errorCode: func.error?.code,
        errorMessage: func.error?.message
      }
    });

    if (func.status == 'failed') {
      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    } else if (func.status == 'succeeded') {
      await db.serverDeploymentStep.update({
        where: { id: data.deployingStepId },
        data: { status: 'succeeded', endedAt: new Date() }
      });

      await deployFunctionServerDiscoverQueue.add({
        serverDeploymentId: data.serverDeploymentId,
        functionServerId: data.functionServerId
      });
    }
  }
);
