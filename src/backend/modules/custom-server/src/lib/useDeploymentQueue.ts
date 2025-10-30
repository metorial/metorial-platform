import { db, ServerVersion } from '@metorial/db';
import { QueueRetryError } from '@metorial/queue';
import { createDeploymentStepManager } from './stepManager';

export let useDeploymentQueue = async (data: {
  lambdaId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}) => {
  let lambda = await db.lambdaServerInstance.findFirst({
    where: { id: data.lambdaId },
    include: {
      immutableCodeBucket: true,
      instance: true,
      customServerVersion: {
        include: {
          push: true,
          deployment: true,
          customServer: true
        }
      }
    }
  });
  if (!lambda) throw new QueueRetryError();

  let customServerVersion = lambda.customServerVersion;
  let deployment = customServerVersion?.deployment;
  if (!customServerVersion || !deployment)
    throw new Error(`Server version not found for remote ID: ${data.lambdaId}`);

  await db.customServerDeployment.updateMany({
    where: { id: deployment.id },
    data: { status: 'deploying', startedAt: new Date() }
  });

  let failDeployment = async () => {
    await db.customServerDeployment.updateMany({
      where: { id: deployment.id },
      data: { status: 'failed', endedAt: new Date() }
    });

    await db.customServerVersion.updateMany({
      where: { id: customServerVersion.id },
      data: { status: 'deployment_failed' }
    });

    await db.customServerDeploymentStep.updateMany({
      where: { deploymentOid: deployment.oid, status: 'running' },
      data: { status: 'failed', endedAt: new Date() }
    });
  };

  let stepManager = createDeploymentStepManager({ deployment });

  return { failDeployment, stepManager, lambda, customServerVersion, deployment };
};
