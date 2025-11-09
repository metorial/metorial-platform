import { db, ServerVersion } from '@metorial/db';
import { codeBucketService } from '@metorial/module-code-bucket';
import { createQueue } from '@metorial/queue';
import { getSentry } from '@metorial/sentry';
import { isAwsLambdaEnabled } from '../deployment/aws-lambda/lib/aws';
import { lambdaDeployMainQueue } from '../deployment/aws-lambda/queues';
import { isDenoDeployEnabled } from '../deployment/deno/deployment';
import { denoDeployMainQueue } from '../deployment/deno/queues/main';
import { pythonDeployMainQueue } from '../deployment/python-local/queues/main';
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
    concurrency: 50
  }
});

export let initializeLambdaQueueProcessor = initializeLambdaQueue.process(async data => {
  let { stepManager, customServerVersion, lambda } = await useDeploymentQueue({
    lambdaId: data.lambdaId,
    serverVersionData: data.serverVersionData
  });

  let deploymentStep = await stepManager.createDeploymentStep({
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

  let provider = lambda.provider;
  let lang: 'python' | 'ts' = 'ts';

  try {
    let metorialJson = await codeBucketService.getFile({
      codeBucket: lambda.immutableCodeBucket,
      path: 'metorial.json'
    });

    let content = JSON.parse(new TextDecoder().decode(metorialJson?.content!));

    if (content.runtime == 'typescript.deno' || content.runtime == 'javascript.deno') {
      if (!isDenoDeployEnabled() && isAwsLambdaEnabled()) {
        provider = 'aws_lambda';
      } else {
        provider = 'deno_deploy';
      }

      lang = 'ts';
    } else if (content.runtime == 'typescript.node' || content.runtime == 'javascript.node') {
      if (!isAwsLambdaEnabled() && isDenoDeployEnabled()) {
        provider = 'deno_deploy';
      } else {
        provider = 'aws_lambda';
      }

      lang = 'ts';
    } else if (content.runtime == 'python') {
      if (isAwsLambdaEnabled()) {
        provider = 'aws_lambda';
        lang = 'python';
      } else {
        provider = 'python_self_hosted';
        lang = 'python';
      }
    }
  } catch {
    deploymentStep.addLog(['Unable to find metorial.json']);
  }

  if (!provider) {
    if (isDenoDeployEnabled()) {
      provider = 'deno_deploy';
    } else {
      provider = 'aws_lambda';
    }
  }

  if (provider != lambda.provider) {
    await db.lambdaServerInstance.updateMany({
      where: { oid: lambda.oid },
      data: { provider }
    });
  }

  if (!lambda.runtime) {
    await db.lambdaServerInstance.updateMany({
      where: { oid: lambda.oid },
      data: {
        runtime: lang == 'python' ? 'aws_lambda_python_3_12' : 'aws_lambda_nodejs_22_x'
      }
    });
  }

  switch (provider) {
    case 'aws_lambda':
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

    case 'python_self_hosted':
      await pythonDeployMainQueue.add({
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
