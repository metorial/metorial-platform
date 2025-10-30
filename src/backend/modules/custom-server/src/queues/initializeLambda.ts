import { db, ServerVersion } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getSentry } from '@metorial/sentry';
import { lambdaDeployMainQueue } from '../deployment/aws-lambda/queues';
import { denoDeployMainQueue } from '../deployment/deno/queues/main';
import { useDeploymentQueue } from '../lib/useDeploymentQueue';

let Sentry = getSentry();

export let initializeLambdaQueue = createQueue<{
  lambdaId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}>({
  name: 'csrv/initLam',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 30 * 1000
    }
  }
});

export let initializeLambdaQueueProcessor = initializeLambdaQueue.process(async data => {
  let { stepManager, customServerVersion, lambda } = await useDeploymentQueue({
    lambdaId: data.lambdaId,
    serverVersionData: data.serverVersionData
  });

  await stepManager.createDeploymentStep({
    type: 'started',
    status: 'completed',
    log: [
      {
        type: 'info',
        lines: [
          `Starting deployment for managed server ${customServerVersion.customServer.name}.`
        ]
      }
    ]
  });

  switch (lambda.provider) {
    case 'aws_lambda':
    case null:
      if (lambda.provider === null) {
        await db.lambdaServerInstance.update({
          where: { oid: lambda.oid },
          data: { provider: 'aws_lambda', runtime: 'aws_lambda_nodejs_24_x' }
        });
      }

      await lambdaDeployMainQueue.add({
        lambdaId: data.lambdaId,
        serverVersionData: data.serverVersionData
      });
      break;

    case 'deno_deploy':
    case 'deno_self_hosted':
      await denoDeployMainQueue.add({
        lambdaId: data.lambdaId,
        serverVersionData: data.serverVersionData
      });
      break;

    default:
      Sentry.captureException(
        new Error(`Unsupported lambda provider: ${(lambda as any).provider}`)
      );
      throw new Error(`Unsupported lambda provider: ${(lambda as any).provider}`);
  }
});
