import { createCron } from '@lowerdeck/cron';
import { generateCode } from '@lowerdeck/id';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import SuperJSON from 'superjson';
import unzipper from 'unzipper';
import { db } from '../../db';
import { env } from '../../env';
import { functionBay, functionBayProvider, functionBayTenant } from '../../functionBay';
import { getId } from '../../id';
import { getRegistryClient, getRegistryQuery } from '../../registry';
import { discoverSlateQueue } from '../discovery/discover';
import { buildSlateDeploymentFiles } from './packageFiles';

let log = (deployment: { id: string } | string, message: string, ...args: any[]) => {
  let deploymentId = typeof deployment === 'string' ? deployment : deployment.id;

  return db.slateDeployment.updateMany({
    where: { id: deploymentId },
    data: {
      internalLogs: {
        push: JSON.stringify(SuperJSON.serialize({ message, args, ts: new Date() }).json)
      }
    }
  });
};

let withErrorLogging = async <T>(
  deployment: { id: string } | string,
  fn: () => Promise<T>
) => {
  try {
    return await fn();
  } catch (e: any) {
    await log(
      deployment,
      `Error in deployment process: ${(e as Error).message}\n${(e as Error).stack}\n${JSON.stringify(e)}\n${JSON.stringify(e?.data)}`
    );

    console.error(`Error in deployment ${JSON.stringify(deployment)}:`, e);

    throw e;
  }
};

export let deploySlateVersionQueue = createQueue<{ versionId: string }>({
  name: 'shub/slv/dep/init',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let deploySlateVersionQueueProcessor = deploySlateVersionQueue.process(async data => {
  let version = await db.slateVersion.findUnique({
    where: { id: data.versionId }
  });
  if (!version) throw new QueueRetryError();

  let deployment = await db.slateDeployment.create({
    data: {
      ...getId('slateDeployment'),
      status: 'pending',

      slateVersionOid: version.oid,
      slateOid: version.slateOid,
      providerOid: functionBayProvider.oid,

      providerDeploymentInfo: null
    }
  });

  log(
    deployment,
    `Created deployment record with id ${deployment.id} for slate version ${version.version}`
  );

  await db.slateVersion.update({
    where: { oid: version.oid },
    data: { status: 'deploying' }
  });

  await db.slateEvent.create({
    data: {
      ...getId('slateEvent'),
      type: 'deployment_started',
      message: `Deployment for version ${version.version} started`,
      slateOid: version.slateOid,
      slateVersionOid: version.oid
    }
  });

  console.log(`Starting deployment for slate version ${version.id} (${version.version})`);

  await deploySlateVersionStartQueue.add({ deploymentId: deployment.id });
});

let deploySlateVersionStartQueue = createQueue<{ deploymentId: string }>({
  name: 'shub/slv/dep/start',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let deploySlateVersionStartQueueProcessor = deploySlateVersionStartQueue.process(
  async data =>
    withErrorLogging(data.deploymentId, async () => {
      let deployment = await db.slateDeployment.findUnique({
        where: { id: data.deploymentId },
        include: {
          slateVersion: true,
          slate: { include: { registry: true } }
        }
      });
      if (!deployment) throw new QueueRetryError();
      if (deployment.isCancelledByRedeploy) return;

      let version = deployment.slateVersion;
      let slate = deployment.slate;

      await log(deployment, `Starting deployment for slate version ${version.version}`);

      let reg = await getRegistryClient(slate.registry);
      let zipRes = await reg.slates[':scopeId'][':slateId'].versions[
        ':versionId'
      ].download.$get({
        param: {
          scopeId: slate.slateScopeIdentifierOnRegistry,
          slateId: slate.slateIdentifierOnRegistry,
          versionId: version.version
        },
        query: getRegistryQuery()
      });
      if ((zipRes.status as any) !== 200)
        throw new Error(
          `Failed to download slate version zip - status ${zipRes.status} - ${await zipRes.text()} - ${slate.slateScopeIdentifierOnRegistry} - ${slate.slateIdentifierOnRegistry} - ${version.version}`
        );
      let zipBuffer = await zipRes.arrayBuffer();

      let directory = await unzipper.Open.buffer(Buffer.from(zipBuffer));
      let archiveFiles = await Promise.all(
        directory.files.map(async file => ({
          path: file.path,
          buffer: await file.buffer()
        }))
      );
      let deploymentFiles = buildSlateDeploymentFiles(archiveFiles);

      await log(deployment, `Using entrypoint ./${deploymentFiles.slateEntrypoint}`);

      let func = await functionBay.function.upsert({
        identifier: `slates::slate_version::${version.id}::${generateCode(6)}`,
        name: `Slate Version ${version.id} Deployment`,
        tenantId: (await functionBayTenant).id
      });

      await log(deployment, `Created function with id ${func.id} for deployment`);

      await log(
        deployment,
        `Created function with id ${func.id} for deployment, creating deployment...`
      );

      let functionDeployment = await functionBay.functionDeployment.create({
        functionId: func.id,
        tenantId: (await functionBayTenant).id,
        name: `Deployment for Slate Version ${version.id}`,
        runtime: {
          identifier: 'nodejs',
          version: '24.x'
        },
        config: {
          memorySizeMb: env.functionBay.FUNCTION_BAY_DEFAULT_MEMORY_MB,
          timeoutSeconds: env.functionBay.FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS
        },
        env: {},
        files: deploymentFiles.files
      });

      await log(
        deployment,
        `Created function deployment with id ${functionDeployment.id} for deployment, updating deployment record...`
      );

      await db.slateDeployment.update({
        where: { id: deployment.id },
        data: {
          providerDeploymentInfo: {
            functionId: func.id,
            functionDeploymentId: functionDeployment.id
          }
        }
      });

      await deploySlateVersionMonitorQueue.add({
        deploymentId: deployment.id,
        functionId: func.id,
        functionDeploymentId: functionDeployment.id
      });
    })
);

let deploySlateVersionMonitorQueue = createQueue<{
  deploymentId: string;
  functionId: string;
  functionDeploymentId: string;
}>({
  name: 'shub/slv/dep/mon',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let deploySlateVersionMonitorQueueProcessor = deploySlateVersionMonitorQueue.process(
  async data =>
    withErrorLogging(data.deploymentId, async () => {
      let deployment = await db.slateDeployment.findUnique({
        where: { id: data.deploymentId }
      });
      if (!deployment) throw new QueueRetryError();
      if (deployment.isCancelledByRedeploy) return;

      let funcDep = await functionBay.functionDeployment.get({
        functionId: data.functionId,
        tenantId: (await functionBayTenant).id,
        functionDeploymentId: data.functionDeploymentId
      });

      if (funcDep.status === 'failed' || funcDep.status === 'succeeded') {
        await deploySlateVersionProviderCompletedQueue.add({
          deploymentId: data.deploymentId,
          functionId: data.functionId,
          functionDeploymentId: data.functionDeploymentId
        });
        return;
      }

      if (funcDep.status !== deployment.status) {
        await db.slateDeployment.update({
          where: { id: deployment.id },
          data: { status: funcDep.status }
        });
      }

      await deploySlateVersionMonitorQueue.add(data, { delay: 2500 });
    })
);

let deploySlateVersionProviderCompletedQueue = createQueue<{
  deploymentId: string;
  functionId: string;
  functionDeploymentId: string;
}>({
  name: 'shub/slv/dep/pcomp',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let deploySlateVersionProviderCompletedQueueProcessor =
  deploySlateVersionProviderCompletedQueue.process(async data =>
    withErrorLogging(data.deploymentId, async () => {
      let deployment = await db.slateDeployment.findUnique({
        where: { id: data.deploymentId }
      });
      if (!deployment) throw new QueueRetryError();
      if (deployment.isCancelledByRedeploy) return;

      await log(deployment, `Function deployment completed, checking final status...`);

      let funcDep = await functionBay.functionDeployment.get({
        functionId: data.functionId,
        tenantId: (await functionBayTenant).id,
        functionDeploymentId: data.functionDeploymentId
      });

      await log(deployment, `Function deployment status: ${funcDep.status}`);

      if (funcDep.status === 'succeeded') {
        await deploySlateVersionCompletedQueue.add({
          deploymentId: data.deploymentId,
          functionId: data.functionId,
          functionDeploymentId: data.functionDeploymentId
        });
        return;
      }

      await log(
        deployment,
        `Function deployment failed with error: ${funcDep.error?.message ?? 'Unknown error'}`
      );

      await deploySlateVersionFailedQueue.add({
        deploymentId: data.deploymentId,
        errorCode: funcDep.error?.code ?? 'unknown_error',
        errorMessage: funcDep.error?.message ?? 'Unknown error during deployment'
      });
    })
  );

let deploySlateVersionFailedQueue = createQueue<{
  deploymentId: string;
  errorCode: string;
  errorMessage: string;
}>({
  name: 'shub/slv/dep/fail',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let deploySlateVersionFailedQueueProcessor = deploySlateVersionFailedQueue.process(
  async data =>
    withErrorLogging(data.deploymentId, async () => {
      let deployment = await db.slateDeployment.findUnique({
        where: { id: data.deploymentId },
        include: { slateVersion: true }
      });
      if (!deployment) throw new QueueRetryError();
      if (deployment.isCancelledByRedeploy) return;

      await log(
        deployment,
        `Marking deployment as failed with error code ${data.errorCode} and message: ${data.errorMessage}`
      );

      await db.slateDeployment.update({
        where: { id: deployment.id },
        data: {
          status: 'failed',

          errorCode: data.errorCode,
          errorMessage: data.errorMessage
        }
      });

      await db.slateVersion.update({
        where: { oid: deployment.slateVersionOid },
        data: {
          status: 'deployment_failed'
        }
      });

      await db.slateEvent.create({
        data: {
          ...getId('slateEvent'),
          type: 'deployment_failed',
          message: `Deployment for version ${deployment.slateVersion.version} failed: ${data.errorMessage}`,
          slateOid: deployment.slateOid,
          slateVersionOid: deployment.slateVersionOid
        }
      });
    })
);

let deploySlateVersionCompletedQueue = createQueue<{
  deploymentId: string;
  functionId: string;
  functionDeploymentId: string;
}>({
  name: 'shub/slv/dep/comp',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let publishLock = createLock({
  name: 'shub/slv/dep/publish/lock',
  redisUrl: env.service.REDIS_URL
});

export let deploySlateVersionCompletedQueueProcessor =
  deploySlateVersionCompletedQueue.process(async data =>
    withErrorLogging(data.deploymentId, async () => {
      let outerDeployment = await db.slateDeployment.findUnique({
        where: { id: data.deploymentId },
        include: { slate: true }
      });
      if (!outerDeployment) throw new QueueRetryError();
      if (outerDeployment.isCancelledByRedeploy) return;

      return publishLock.usingLock(outerDeployment.slate.id, async () => {
        let deployment = await db.slateDeployment.findUniqueOrThrow({
          where: { id: data.deploymentId },
          include: { slateVersion: true, slate: { include: { currentVersion: true } } }
        });
        let slate = deployment.slate;

        await log(deployment, `Acquired publish lock for slate, finalizing deployment...`);

        let funcDep = await functionBay.functionDeployment.get({
          functionId: data.functionId,
          tenantId: (await functionBayTenant).id,
          functionDeploymentId: data.functionDeploymentId
        });

        await log(deployment, `Function deployment status: ${funcDep.status}`);

        let updatedDeployment = await db.slateDeployment.update({
          where: { id: deployment.id },
          data: {
            status: 'succeeded',

            providerDeploymentInfo: {
              functionId: data.functionId,
              functionDeploymentId: funcDep.id,
              functionVersionId: funcDep.version?.id
            }
          }
        });

        await db.slateVersion.updateMany({
          where: { oid: deployment.slateVersion.oid },
          data: {
            status: 'discovering',
            providerDeploymentInfo: updatedDeployment.providerDeploymentInfo,
            activeDeploymentOid: updatedDeployment.oid
          }
        });

        await db.slateEvent.create({
          data: {
            ...getId('slateEvent'),
            type: 'deployment_succeeded',
            message: `Deployment for version ${deployment.slateVersion.version} succeeded.`,
            slateOid: slate.oid,
            slateVersionOid: deployment.slateVersion.oid
          }
        });

        await log(deployment, `Deployment marked as succeeded, adding to discovery queue...`);

        await discoverSlateQueue.add(
          { versionId: deployment.slateVersion.id },
          { delay: 10_000 }
        );
      });
    })
  );

export let failOldDeploymentsCron = createCron(
  {
    name: 'shub/slv/dep/fail-old',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    let fiveDaysAgo = subDays(new Date(), 5);

    let oldDeployments = await db.slateDeployment.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: fiveDaysAgo }
      }
    });

    await deploySlateVersionFailedQueue.addMany(
      oldDeployments.map(d => ({
        deploymentId: d.id,
        errorCode: 'deployment_timeout',
        errorMessage: 'Deployment did not complete within 1 hour'
      }))
    );
  }
);
