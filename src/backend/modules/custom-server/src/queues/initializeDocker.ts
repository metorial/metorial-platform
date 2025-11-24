import { db, ServerVersion, withTransaction } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getSentry } from '@metorial/sentry';
import { checkDockerTag } from '../lib/docker';
import { createDeploymentStepManager } from '../lib/stepManager';
import { customServerVersionService } from '../services';

let Sentry = getSentry();

export let initializeDockerQueue = createQueue<{
  dockerId: string;
  serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'>;
}>({
  name: 'csrv/initDok',
  jobOpts: {
    attempts: 10
  },
  workerOpts: {
    concurrency: 100
  }
});

export let initializeDockerQueueProcessor = initializeDockerQueue.process(async data => {
  let docker = await db.dockerServerInstance.findFirst({
    where: { id: data.dockerId },
    include: {
      instance: true,
      customServerVersion: {
        include: {
          deployment: true,
          customServer: true
        }
      }
    }
  });
  if (!docker) throw new QueueRetryError();

  let instance = docker.instance;

  let customServerVersion = docker.customServerVersion;
  let deployment = customServerVersion?.deployment;
  if (!customServerVersion || !deployment)
    throw new Error(`Docker server version not found for docker ID: ${data.dockerId}`);

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

  await stepManager.createDeploymentStep({
    type: 'started',
    status: 'completed',
    log: [
      {
        type: 'info',
        lines: [`Starting deployment for docker server ${docker.dockerImage}.`]
      }
    ]
  });

  let discoveryStep = await stepManager.createDeploymentStep({
    type: 'discovering',
    status: 'running',
    log: [
      {
        type: 'info',
        lines: [`Attempting to discover the configuration for the docker image...`]
      }
    ]
  });

  let tag = docker.dockerTag;

  try {
    await discoveryStep.addLog([
      `Checking if tag ${tag} exists for image ${docker.dockerImage}...`
    ]);

    let ok = await checkDockerTag(docker.dockerImage, tag);
    if (!ok) throw new Error(`Docker tag ${tag} not found for image ${docker.dockerImage}`);

    await discoveryStep.complete([
      {
        lines: [`Tag ${tag} exists for image ${docker.dockerImage}.`],
        type: 'info'
      }
    ]);
  } catch (error: any) {
    console.error('Error during OAuth discovery:', error);
    Sentry.captureException(error);
    await discoveryStep.fail();
    await failDeployment();
    return;
  }

  data.serverVersionData.dockerTag = tag;

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
        data: data.serverVersionData
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
          lines: [`Docker server deployed to Metorial successfully.`]
        }
      ]
    });
  } catch (error: any) {
    console.error('Error during docker server deployment:', error);
    Sentry.captureException(error);
    await deploymentStep.fail([
      {
        type: 'error',
        lines: [`Docker server deployment failed.`]
      }
    ]);
    await failDeployment();
    return;
  }
});
