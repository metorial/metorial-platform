import {
  DescribeTasksCommand,
  RegisterTaskDefinitionCommandOutput,
  RunTaskCommand
} from '@aws-sdk/client-ecs';
import { GetRoleCommandOutput } from '@aws-sdk/client-iam';
import { Runtime } from '@aws-sdk/client-lambda';
import { db, ID, ServerVersion, withTransaction } from '@metorial/db';
import { generatePlainId } from '@metorial/id';
import { codeBucketService } from '@metorial/module-code-bucket';
import { providerOauthConfigService } from '@metorial/module-provider-oauth';
import { createQueue } from '@metorial/queue';
import { getSentry } from '@metorial/sentry';
import { useDeploymentQueue } from '../../../lib/useDeploymentQueue';
import { customServerVersionService } from '../../../services';
import { awsEcs, getResourceName } from '../lib/aws';
import { deployLambda, ensureLambdaExecutionRole } from '../lib/deployLambda';
import { ensureCluster } from '../lib/ensureCluster';
import { ensureLogGroup } from '../lib/ensureLogGroup';
import { ensureRole } from '../lib/ensureRole';
import { ensureS3Bucket } from '../lib/ensureS3Bucket';
import {
  ensureTaskDefinition,
  getEcsLogs,
  getEcsLogStreamName
} from '../lib/ensureTaskDefinition';
import { ensureVpc, VpcResources } from '../lib/ensureVpc';
import { discoverLambda, invokeLambdaCallbacks, invokeLambdaOAuth } from '../lib/invokeLambda';

let Sentry = getSentry();

export let lambdaDeployMainQueue = createQueue<{
  lambdaId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}>({
  name: 'csrv/almb/main',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 30 * 1000
    }
  }
});

export let lambdaDeployMainQueueProcessor = lambdaDeployMainQueue.process(async data => {
  let { stepManager, failDeployment, lambda } = await useDeploymentQueue({
    lambdaId: data.lambdaId,
    serverVersionData: data.serverVersionData
  });

  let checkStep = await stepManager.createDeploymentStep({
    type: 'lambda_deploy_create',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Preparing deployment for managed server...`]
      }
    ]
  });

  let clusterName = getResourceName('cluster');
  let logGroupName = getResourceName('build-logs');
  let vpc = getResourceName('vpc');
  let s3Bucket = getResourceName('csrv-lambda-output');

  let vpcResources: VpcResources;
  let executionRole: GetRoleCommandOutput;
  let taskRole: GetRoleCommandOutput;

  let taskDef: RegisterTaskDefinitionCommandOutput;

  let s3Key = `mtrl-csrv-out-${lambda.id}.zip`;

  try {
    let executionRoleName = getResourceName('execution-role');
    let taskRoleName = getResourceName('task-role');

    await ensureS3Bucket(s3Bucket);

    await ensureCluster(clusterName);

    await ensureLogGroup(logGroupName);

    executionRole = await ensureRole(
      executionRoleName,
      {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'ecs-tasks.amazonaws.com' },
            Action: 'sts:AssumeRole'
          }
        ]
      },
      [
        'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
        'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess'
      ]
    );

    taskRole = await ensureRole(
      taskRoleName,
      {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'ecs-tasks.amazonaws.com' },
            Action: 'sts:AssumeRole'
          }
        ]
      },
      [],
      {
        S3AccessPolicy: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: ['s3:PutObject', 's3:PutObjectTagging'],
              Resource: `arn:aws:s3:::${s3Bucket}/${s3Key}*`
            }
          ]
        }
      }
    );

    vpcResources = await ensureVpc(vpc);

    let zipUrl = await codeBucketService.getBucketFilesAsZip({
      codeBucket: lambda.immutableCodeBucket
    });

    let buildImageUri = lambda.runtime?.startsWith('aws_lambda_python')
      ? 'public.ecr.aws/z8i8n6f7/metorial/python-lambda-build-image-v1:latest'
      : 'public.ecr.aws/z8i8n6f7/metorial/js-lambda-build-image-v1:latest';

    taskDef = await ensureTaskDefinition({
      env: {
        ZIP_URL: zipUrl.downloadUrl,
        S3_BUCKET: s3Bucket,
        S3_KEY: s3Key
      },
      logGroupName,
      taskName: getResourceName(`lambda-${generatePlainId(16)}`),
      executionRoleArn: executionRole.Role?.Arn!,
      taskRoleArn: taskRole.Role?.Arn!,
      buildImageUri
    });
  } catch (error) {
    console.error('Error during managed server deployment resource preparation:', error);
    await checkStep.fail([
      {
        type: 'error',
        lines: ['Unable to prepare resources for deployment.']
      }
    ]);
    Sentry.captureException(error);
    await failDeployment();
    return;
  }

  checkStep.complete([]);

  let deployStep = await stepManager.createDeploymentStep({
    type: 'lambda_deploy_build',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Starting deployment for managed server...`]
      }
    ]
  });

  try {
    let run = await awsEcs.send(
      new RunTaskCommand({
        cluster: clusterName,
        launchType: 'FARGATE',
        taskDefinition: taskDef.taskDefinition?.taskDefinitionArn,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: [vpcResources.publicSubnetId],
            assignPublicIp: 'ENABLED'
          }
        }
      })
    );
    let taskArn = run.tasks?.[0]?.taskArn;

    await lambdaDeployCheckerQueue.add({
      lambdaId: lambda.id,
      taskArn: taskArn!,
      clusterName,
      serverVersionData: data.serverVersionData,
      s3Bucket,
      s3Key
    });
  } catch (error) {
    console.error('Error during managed server deployment task start:', error);
    await await deployStep.fail([
      {
        type: 'error',
        lines: ['Unable to start deployment task.']
      }
    ]);
    Sentry.captureException(error);
    await failDeployment();
    return;
  }
});

let lambdaDeployCheckerQueue = createQueue<{
  lambdaId: string;
  taskArn: string;
  clusterName: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
  lastStatus?: string;
  logNextToken?: string;
  s3Bucket: string;
  s3Key: string;
}>({
  name: 'csrv/almb/checker',
  jobOpts: {
    attempts: 100,
    backoff: {
      type: 'fixed',
      delay: 15000
    }
  },
  workerOpts: {
    concurrency: 15,
    limiter: {
      // Avoid AWS API rate limits
      max: 50,
      duration: 30 * 1000
    }
  }
});

export let lambdaDeployCheckerQueueProcessor = lambdaDeployCheckerQueue.process(async data => {
  let { stepManager, failDeployment } = await useDeploymentQueue({
    lambdaId: data.lambdaId,
    serverVersionData: data.serverVersionData
  });

  let deployStep = await stepManager.createDeploymentStep({
    type: 'lambda_deploy_build',
    status: 'running'
  });

  let taskStatus = await awsEcs.send(
    new DescribeTasksCommand({
      cluster: data.clusterName,
      tasks: [data.taskArn]
    })
  );
  let task = taskStatus.tasks?.[0];

  if (task?.lastStatus != data.lastStatus) {
    if (task?.lastStatus == 'PROVISIONING') {
      await deployStep.addLog(['Provisioning resources for deployment...'], 'info');
    } else if (task?.lastStatus == 'RUNNING') {
      await deployStep.addLog(['Deployment task is now running.'], 'info');
    }
  }

  let logGroupName = getResourceName('build-logs');
  let logStreamName = getEcsLogStreamName(data.taskArn);

  let logResult = await getEcsLogs({
    logGroupName,
    logStreamName,
    nextToken: data.logNextToken,
    startFromHead: true,
    limit: 250
  });

  if (logResult.events.length > 0) {
    let logLines = logResult.events.map(e => e.message);
    await deployStep.addLog(logLines, 'info');
  }

  if (
    !task ||
    task?.lastStatus == 'STOPPED' ||
    task?.lastStatus == 'DEPROVISIONING' ||
    task?.lastStatus == 'DELETED'
  ) {
    await deployStep.complete([]);

    let exitCodes = task?.containers
      ?.map(c => c.exitCode)
      .filter(code => code !== undefined)
      .map(code => code!);
    let nonZeroExit = !!exitCodes?.some(code => code != 0);

    if (nonZeroExit) {
      await deployStep.fail([
        {
          type: 'error',
          lines: ['Deployment task failed during execution.']
        }
      ]);

      await failDeployment();
    } else {
      await deployStep.complete([
        {
          type: 'info',
          lines: ['Deployment task completed successfully.']
        }
      ]);

      await lambdaDeployCompleterQueue.add({
        lambdaId: data.lambdaId,
        serverVersionData: data.serverVersionData,
        s3Bucket: data.s3Bucket,
        s3Key: data.s3Key
      });
    }

    return;
  }

  await lambdaDeployCheckerQueue.add(
    {
      ...data,
      logNextToken: logResult.nextForwardToken,
      lastStatus: task?.lastStatus
    },
    {
      delay: 1500
    }
  );
});

let lambdaDeployCompleterQueue = createQueue<{
  lambdaId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
  s3Bucket: string;
  s3Key: string;
}>({
  name: 'csrv/almb/complete',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    concurrency: 15
  }
});

export let lambdaDeployCompleterQueueProcessor = lambdaDeployCompleterQueue.process(
  async data => {
    let { stepManager, lambda, deployment, customServerVersion, failDeployment } =
      await useDeploymentQueue({
        lambdaId: data.lambdaId,
        serverVersionData: data.serverVersionData
      });

    let deployStep = await stepManager.createDeploymentStep({
      type: 'lambda_deploy_publish',
      status: 'running',
      log: [
        {
          type: 'info',
          lines: [`Propagating server deployment...`]
        }
      ]
    });

    let handler: string;
    let runtime: Runtime;

    switch (lambda.runtime) {
      case 'aws_lambda_nodejs_24_x':
        handler = 'dist/index.handler';
        runtime = Runtime.nodejs22x;
        break;
      case 'aws_lambda_nodejs_22_x':
        handler = 'dist/index.handler';
        runtime = Runtime.nodejs22x;
        break;
      case 'aws_lambda_python_3_9':
        handler = 'index.handler';
        runtime = Runtime.python39;
        break;
      case 'aws_lambda_python_3_10':
        handler = 'index.handler';
        runtime = Runtime.python310;
        break;
      case 'aws_lambda_python_3_11':
        handler = 'index.handler';
        runtime = Runtime.python311;
        break;
      case 'aws_lambda_python_3_12':
        handler = 'index.handler';
        runtime = Runtime.python312;
        break;
      default:
        await deployStep.fail([
          {
            type: 'error',
            lines: ['Unsupported runtime for Lambda deployment.']
          }
        ]);
        await failDeployment();
        return;
    }

    try {
      let deployedLambda = await deployLambda({
        functionName: `mtrl-csrv-${data.lambdaId}`,
        s3Bucket: data.s3Bucket,
        s3Key: data.s3Key,
        roleArn: (await ensureLambdaExecutionRole(getResourceName('lambda-exec-role'))).Role!
          .Arn!,
        handler,
        runtime: runtime as any,
        memorySize: 512,
        timeout: 20
      });

      await db.lambdaServerInstance.updateMany({
        where: { id: lambda.id },
        data: {
          status: 'deploying',
          providerInfo: deployedLambda,
          providerResourceId: deployedLambda.functionArn,
          runtime: 'aws_lambda_nodejs_24_x',
          provider: 'aws_lambda',
          platform: 'metorial_stellar_v1',
          protocol: 'metorial_stellar_over_aws_lambda_v1',
          providerResourceAccessIdentifier: deployedLambda.functionName
        }
      });

      await deployStep.complete([
        {
          type: 'info',
          lines: ['Propagation completed successfully.']
        }
      ]);

      await discoveryQueue.add({
        lambdaId: data.lambdaId,
        serverVersionData: data.serverVersionData
      });
    } catch (error) {
      console.error('Error during managed server deployment finalization:', error);
      await deployStep.fail([
        {
          type: 'error',
          lines: ['Failed to finalize managed server deployment to AWS Lambda.']
        }
      ]);
      Sentry.captureException(error);
      await failDeployment();
      return;
    }
  }
);

let discoveryQueue = createQueue<{
  lambdaId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}>({
  name: 'csrv/almb/discovery',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    concurrency: 15
  }
});

export let lambdaDeployDiscoveryQueueProcessor = discoveryQueue.process(async data => {
  let { stepManager, failDeployment, lambda } = await useDeploymentQueue({
    lambdaId: data.lambdaId,
    serverVersionData: data.serverVersionData
  });

  let discoverStep = await stepManager.createDeploymentStep({
    type: 'discovering',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Starting discovery for managed server...`]
      }
    ]
  });

  try {
    let discoverRes = await discoverLambda({
      functionName: lambda.providerResourceAccessIdentifier!,
      args: {}
    });
    if (discoverRes.logs.length) {
      discoverStep.addLog(
        discoverRes.logs.flatMap(log => log.lines),
        'info'
      );
    }

    let oauthRes = await invokeLambdaOAuth({
      functionName: lambda.providerResourceAccessIdentifier!,
      oauthAction: 'get'
    });
    if (oauthRes.logs.length) {
      await discoverStep.addLog(
        oauthRes.logs.flatMap(log => log.lines),
        'info'
      );
    }

    let callbacksRes = await invokeLambdaCallbacks({
      functionName: lambda.providerResourceAccessIdentifier!,
      callbackAction: 'get'
    });
    if (callbacksRes.logs.length) {
      await discoverStep.addLog(
        callbacksRes.logs.flatMap(log => log.lines),
        'info'
      );
    }

    let error = discoverRes.error || oauthRes.error || callbacksRes.error;
    if (error) {
      await discoverStep.addLog(
        [`Server discovery failed: ${error.code} - ${error.message}`],
        'error'
      );
      await discoverStep.fail([
        {
          type: 'error',
          lines: [`Managed server discovery failed.`]
        }
      ]);
      await failDeployment();
      return;
    }

    let discovery = discoverRes.discovery!;
    let oauth = oauthRes.oauth!;
    let callbacks = callbacksRes.callbacks!;

    data.serverVersionData.tools = discovery.tools ?? [];
    data.serverVersionData.resourceTemplates = discovery.resourceTemplates ?? [];
    data.serverVersionData.prompts = discovery.prompts ?? [];
    data.serverVersionData.serverCapabilities = discovery.capabilities ?? [];
    data.serverVersionData.serverInfo = discovery.implementation ?? [];
    data.serverVersionData.serverInstructions = discovery.instructions || null;
    await discoverStep.addLog([`Server capabilities discovered successfully.`], 'info');
    await discoverStep.addLog(JSON.stringify(discovery, null, 2).split('\n'), 'info');

    if (oauth.enabled) {
      let config = await providerOauthConfigService.createConfig({
        instance: lambda.instance,
        implementation: {
          type: 'managed_server_lambda',
          hasRemoteOauthForm: !!oauth.hasForm,
          lambdaServerInstanceOid: lambda.oid
        }
      });
      await db.lambdaServerInstance.updateMany({
        where: { id: lambda.id },
        data: {
          providerOAuthConfigOid: config.oid
        }
      });
      await discoverStep.addLog(
        ['Server implements custom OAuth. OAuth configuration created successfully.'],
        'info'
      );
    } else if (lambda.providerOAuthConfigOid) {
      let currentOauthConfig = await db.providerOAuthConfig.findFirstOrThrow({
        where: { oid: lambda.providerOAuthConfigOid }
      });

      // If the server used to be oauth enabled but isn't anymore,
      // we remove the config from the lambda
      if (currentOauthConfig.type == 'managed_server_http') {
        await db.lambdaServerInstance.updateMany({
          where: { id: lambda.id },
          data: {
            providerOAuthConfigOid: null
          }
        });
      }
    }

    if (callbacks.enabled) {
      let callbackTemplate = await db.callbackTemplate.create({
        data: {
          id: await ID.generateId('callbackTemplate'),
          eventType: callbacks.type
        }
      });

      await db.lambdaServerInstance.updateMany({
        where: { id: lambda.id },
        data: {
          callbackTemplateOid: callbackTemplate.oid
        }
      });

      await discoverStep.addLog(['Discovered server callback support.'], 'info');
    }

    await discoverStep.complete();

    await lambdaDeployFinalizerQueue.add({
      lambdaId: data.lambdaId,
      serverVersionData: data.serverVersionData
    });
  } catch (error: any) {
    console.error('Error during managed server discovery:', error);
    Sentry.captureException(error);

    if (error?.response?.data?.message) {
      await discoverStep.addLog([error.response.data.message], 'error');
    }

    await discoverStep.fail([
      {
        type: 'error',
        lines: [`Managed server discovery failed.`]
      }
    ]);
    await failDeployment();
    return;
  }
});

let lambdaDeployFinalizerQueue = createQueue<{
  lambdaId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}>({
  name: 'csrv/almb/finalizer',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    concurrency: 15
  }
});

export let lambdaDeployFinalizerQueueProcessor = lambdaDeployFinalizerQueue.process(
  async data => {
    let { stepManager, failDeployment, lambda, customServerVersion, deployment } =
      await useDeploymentQueue({
        lambdaId: data.lambdaId,
        serverVersionData: data.serverVersionData
      });

    let deploymentStep = await stepManager.createDeploymentStep({
      type: 'deploying',
      status: 'running',
      log: [
        {
          type: 'info',
          lines: ['Deploying custom server to Metorial...']
        }
      ]
    });

    try {
      await withTransaction(async db => {
        await deploymentStep.addLog(['Creating server version...']);

        let serverVersion = await db.serverVersion.create({
          data: {
            ...data.serverVersionData,
            lambdaOid: lambda.oid
          }
        });

        let version = await db.customServerVersion.update({
          where: { id: customServerVersion.id },
          data: {
            status: 'available',
            serverVersionOid: serverVersion.oid
          },
          include: {
            serverVersion: true
          }
        });

        await deploymentStep.addLog(['Updating current version...']);

        await customServerVersionService.setCurrentVersion({
          server: customServerVersion.customServer,
          isEphemeralUpdate: true,
          version
        });

        await db.customServerDeployment.updateMany({
          where: { id: deployment.id },
          data: {
            status: 'completed',
            endedAt: new Date()
          }
        });

        await db.customServerDeploymentStep.updateMany({
          where: { deploymentOid: deployment.oid, status: 'running' },
          data: { status: 'completed', endedAt: new Date() }
        });
      });

      await deploymentStep.complete();

      await stepManager.createDeploymentStep({
        type: 'deployed',
        status: 'completed',
        log: [
          {
            type: 'info',
            lines: [`Managed server deployed to Metorial successfully.`]
          }
        ]
      });
    } catch (error: any) {
      console.error('Error during managed server deployment:', error);
      Sentry.captureException(error);
      await deploymentStep.fail([
        {
          type: 'error',
          lines: [`Managed server deployment failed.`]
        }
      ]);
      await failDeployment();
      return;
    }
  }
);
