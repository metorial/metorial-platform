import { functionBayRuntimeConfig, type FunctionBayRuntimeConfig } from '@function-bay/types';
import { generatePlainId } from '@lowerdeck/id';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { v } from '@lowerdeck/validation';
import { Readable } from 'stream';
import { db } from '../db';
import { encryption } from '../encryption';
import { env } from '../env';
import { ensureForgeWorkflow, forge } from '../forge';
import { ID, snowflake } from '../id';
import { defaultProvider } from '../providers';
import { layer } from '../providers/aws-lambda/runtime';
import {
  MANIFEST_ARTIFACT_NAME,
  MANIFEST_PATH,
  OUTPUT_ARTIFACT_NAME,
  OUTPUT_ZIP_PATH
} from '../providers/const';
import { storage } from '../storage';

export let startBuildQueue = createQueue<{
  deploymentId: string;
  files: { filename: string; content: string; encoding?: 'utf-8' | 'base64' }[];
}>({
  name: 'fbay/build/start',
  redisUrl: env.service.REDIS_URL
});

let startBuildQueueProcessor = startBuildQueue.process(async data => {
  let deployment = await db.functionDeployment.findFirst({
    where: { id: data.deploymentId },
    include: {
      runtime: true,
      function: {
        include: {
          tenant: true
        }
      }
    }
  });
  if (!deployment) throw new QueueRetryError();

  let workflow = await ensureForgeWorkflow({
    tenant: deployment.function.tenant,
    runtime: deployment.runtime,
    steps: defaultProvider.workflow
  });

  let envVars: Record<string, string> = JSON.parse(
    await encryption.decrypt({
      entityId: deployment.id,
      encrypted: deployment.encryptedEnvironmentVariables
    })
  );

  let run = await forge.workflowRun.create({
    tenantId: deployment.function.tenant.identifier,
    workflowId: workflow.id,
    files: data.files,

    env: {
      ...envVars,

      METORIAL_FUNCTION_BAY_MANIFEST_DESTINATION: MANIFEST_PATH,
      METORIAL_FUNCTION_BAY_OUTPUT_DESTINATION: OUTPUT_ZIP_PATH,
      METORIAL_FUNCTION_BAY_BUILD_LAYER: JSON.stringify(layer)
    }
  });

  await db.functionDeployment.update({
    where: { oid: deployment.oid },
    data: { forgeRunId: run.id, forgeWorkflowId: workflow.id }
  });

  await monitorBuildQueue.add({
    hasStarted: false,

    deploymentId: deployment.id,
    runId: run.id,
    workflowId: workflow.id,
    tenantId: deployment.function.tenant.identifier
  });
});

let monitorBuildQueue = createQueue<{
  hasStarted: boolean;
  deploymentId: string;
  runId: string;
  workflowId: string;
  tenantId: string;
}>({
  name: 'fbay/build/mon',
  redisUrl: env.service.REDIS_URL
});

let monitorBuildQueueProcessor = monitorBuildQueue.process(async data => {
  let run = await forge.workflowRun.get({
    tenantId: data.tenantId,
    workflowId: data.workflowId,
    workflowRunId: data.runId
  });

  if (!data.hasStarted && run.status != 'pending') {
    await db.functionDeployment.update({
      where: { id: data.deploymentId },
      data: { status: 'running' }
    });
    data.hasStarted = true;
  }

  if (run.status == 'failed' || run.status == 'succeeded') {
    await workflowFinishedBuildQueue.add(data);
  } else {
    await monitorBuildQueue.add(data, { delay: 5000 });
  }
});

let workflowFinishedBuildQueue = createQueue<{
  deploymentId: string;
  runId: string;
  workflowId: string;
  tenantId: string;
}>({
  name: 'fbay/build/wfin',
  redisUrl: env.service.REDIS_URL
});

let workflowFinishedBuildQueueProcessor = workflowFinishedBuildQueue.process(async data => {
  let run = await forge.workflowRun.get({
    tenantId: data.tenantId,
    workflowId: data.workflowId,
    workflowRunId: data.runId
  });

  if (run.status == 'succeeded') {
    let manifestArtifact = run.artifacts.find(a => a.name === MANIFEST_ARTIFACT_NAME);
    let outputArtifact = run.artifacts.find(a => a.name === OUTPUT_ARTIFACT_NAME);

    if (!manifestArtifact || !outputArtifact) {
      await errorQueue.add({
        deploymentId: data.deploymentId,
        code: 'function_bay.build_runtime_error',
        message: 'The build runtime did not produce the expected artifacts.'
      });
      return;
    }

    let manifest = await fetch(manifestArtifact.url.url).then(res => res.json());

    let valRes = v
      .object({
        hash: v.string(),
        runtime: functionBayRuntimeConfig
      })
      .validate(manifest);
    if (!valRes.success) {
      await errorQueue.add({
        deploymentId: data.deploymentId,
        code: 'function_bay.build_invalid_manifest',
        message: `The build runtime produced an invalid manifest: ${JSON.stringify(
          valRes.errors
        )}`
      });
      return;
    }

    await deployToRuntimeQueue.add(
      {
        deploymentId: data.deploymentId,
        outputUrl: outputArtifact.url.url,
        manifest: valRes.value as any
      },
      {
        delay: 5000
      }
    );
  } else {
    await errorQueue.add({
      deploymentId: data.deploymentId,
      code: 'function_bay.build_failed',
      message: 'The build workflow run failed.'
    });
  }
});

let deployToRuntimeQueue = createQueue<{
  deploymentId: string;
  manifest: {
    hash: string;
    runtime: FunctionBayRuntimeConfig;
  };
  outputUrl: string;
}>({
  name: 'fbay/build/drun',
  redisUrl: env.service.REDIS_URL
});

let deployToRuntimeQueueProcessor = deployToRuntimeQueue.process(async data => {
  let deployment = await db.functionDeployment.findFirst({
    where: { id: data.deploymentId },
    include: {
      function: true,
      runtime: true
    }
  });
  if (!deployment) throw new QueueRetryError();

  try {
    let output = JSON.stringify([Date.now(), 'Deploying function to runtime...']);
    await db.functionDeploymentStep.updateMany({
      where: { functionDeploymentOid: deployment.oid, type: 'deploy' },
      data: { status: 'running', output }
    });

    let versionId = await ID.generateId('functionVersion');

    let env = JSON.parse(
      await encryption.decrypt({
        entityId: deployment.id,
        encrypted: deployment.encryptedEnvironmentVariables
      })
    );

    let res = await defaultProvider.deployFunction({
      functionDeployment: deployment,
      function: deployment.function,
      functionVersion: { id: versionId },
      runtime: deployment.runtime,
      runtimeConfig: data.manifest.runtime,
      zipFileUrl: data.outputUrl,
      env
    });

    output += `\n${JSON.stringify([Date.now(), 'Function deployed successfully.'])}`;
    await db.functionDeploymentStep.updateMany({
      where: { functionDeploymentOid: deployment.oid, type: 'deploy' },
      data: { status: 'succeeded', output }
    });

    await deployToFunctionBayQueue.add({
      deploymentId: deployment.id,
      manifest: data.manifest,
      outputUrl: data.outputUrl,
      providerData: res.providerData,
      functionVersionId: versionId
    });
  } catch (err: any) {
    let output = JSON.stringify([Date.now(), `Error deploying function: ${err.message}`]);
    await db.functionDeploymentStep.updateMany({
      where: { functionDeploymentOid: deployment.oid, type: 'deploy' },
      data: { status: 'failed', output }
    });

    await errorQueue.add({
      deploymentId: deployment.id,
      code: 'function_bay.deploy_runtime_error',
      message: `Error deploying function to runtime: ${err.message}`
    });
  }
});

let deployToFunctionBayQueue = createQueue<{
  deploymentId: string;
  manifest: {
    hash: string;
    runtime: FunctionBayRuntimeConfig;
  };
  outputUrl: string;
  providerData: any;
  functionVersionId: string;
}>({
  name: 'fbay/build/dfun',
  redisUrl: env.service.REDIS_URL
});

let deployToFunctionBayQueueProcessor = deployToFunctionBayQueue.process(async data => {
  let deployment = await db.functionDeployment.findFirst({
    where: { id: data.deploymentId }
  });
  if (!deployment) throw new QueueRetryError();

  let bundle = await db.functionBundle.create({
    data: {
      oid: snowflake.nextId(),
      status: 'uploading',
      id: await ID.generateId('functionBundle'),
      functionOid: deployment.functionOid
    }
  });

  let version = await db.functionVersion.create({
    data: {
      oid: snowflake.nextId(),
      id: data.functionVersionId,
      identifier: generatePlainId(12),

      name: deployment.name,
      status: 'active',

      functionOid: deployment.functionOid,
      runtimeOid: deployment.runtimeOid,
      functionBundleOid: bundle.oid,

      encryptedEnvironmentVariables: deployment.encryptedEnvironmentVariables,

      configuration: deployment.configuration,
      providerData: data.providerData,
      manifest: data.manifest
    }
  });

  await db.functionDeployment.update({
    where: { oid: deployment.oid },
    data: { functionVersionOid: version.oid }
  });

  await succeededQueue.add({ deploymentId: deployment.id });

  await uploadBundleQueue.add({
    deploymentId: deployment.id,
    bundleId: bundle.id,
    outputUrl: data.outputUrl
  });
});

let succeededQueue = createQueue<{
  deploymentId: string;
}>({
  name: 'fbay/build/suc',
  redisUrl: env.service.REDIS_URL
});

let succeededQueueProcessor = succeededQueue.process(async data => {
  let deployment = await db.functionDeployment.findFirst({
    where: { id: data.deploymentId }
  });
  if (!deployment) throw new QueueRetryError();

  await db.functionDeployment.update({
    where: { oid: deployment.oid },
    data: { status: 'succeeded' }
  });
  await db.function.update({
    where: { oid: deployment.functionOid },
    data: { currentVersionOid: deployment.functionVersionOid }
  });

  await cleanupQueue.add({ deploymentId: deployment.id }, { delay: 60000 });
});

let errorQueue = createQueue<{
  deploymentId: string;
  code: string;
  message: string;
}>({
  name: 'fbay/build/err',
  redisUrl: env.service.REDIS_URL
});

let errorQueueProcessor = errorQueue.process(async data => {
  let deployment = await db.functionDeployment.update({
    where: { id: data.deploymentId },
    data: {
      status: 'failed',
      errorCode: data.code,
      errorMessage: data.message
    }
  });

  await db.functionDeploymentStep.updateMany({
    where: {
      functionDeploymentOid: deployment.oid,
      status: 'pending'
    },
    data: {
      status: 'failed'
    }
  });

  let deploymentStep = await db.functionDeploymentStep.findFirst({
    where: {
      functionDeploymentOid: deployment.oid,
      type: 'deploy'
    }
  });

  if (deploymentStep) {
    await db.functionDeploymentStep.updateMany({
      where: {
        oid: deploymentStep.oid
      },
      data: {
        status: 'failed',
        output: `${deploymentStep.output}\n${JSON.stringify([Date.now(), `[Error ${data.code}]: ${data.message}`])}`
      }
    });
  }

  await cleanupQueue.add({ deploymentId: deployment.id }, { delay: 60000 });
});

let uploadBundleQueue = createQueue<{
  deploymentId: string;
  bundleId: string;
  outputUrl: string;
}>({
  name: 'fbay/build/upbndl',
  redisUrl: env.service.REDIS_URL
});

let uploadBundleQueueProcessor = uploadBundleQueue.process(async data => {
  let storageKey = `bundles/${data.bundleId}.zip`;
  let bucket = env.storage.BUNDLE_BUCKET_NAME;

  try {
    await storage.putObject(
      bucket,
      storageKey,
      await fetch(data.outputUrl).then(res => Readable.fromWeb(res.body! as any) as any),
      'application/zip'
    );

    await db.functionBundle.updateMany({
      where: { id: data.bundleId },
      data: {
        status: 'available',
        storageKey,
        bucket
      }
    });
  } catch (err) {
    await db.functionBundle.updateMany({
      where: { id: data.bundleId },
      data: { status: 'failed' }
    });

    throw err; // Throw to retry, but we mark the bundle as failed already
  }
});

let cleanupQueue = createQueue<{
  deploymentId: string;
}>({
  name: 'fbay/build/cleanup',
  redisUrl: env.service.REDIS_URL
});

let cleanupQueueProcessor = cleanupQueue.process(async data => {
  await db.functionDeployment.updateMany({
    where: { id: data.deploymentId },
    data: { encryptedEnvironmentVariables: '' }
  });
});

export let buildProcessors = combineQueueProcessors([
  startBuildQueueProcessor,
  monitorBuildQueueProcessor,
  workflowFinishedBuildQueueProcessor,
  deployToRuntimeQueueProcessor,
  succeededQueueProcessor,
  errorQueueProcessor,
  cleanupQueueProcessor,
  deployToFunctionBayQueueProcessor,
  uploadBundleQueueProcessor
]);
