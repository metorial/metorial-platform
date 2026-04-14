import { createLock } from '@lowerdeck/lock';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { workflowArtifactService } from '../../services';
import { storage } from '../../storage';

let runLock = createLock({
  name: 'frg/bctx/runlock',
  redisUrl: env.service.REDIS_URL
});

export let buildEndedQueue = createQueue<{
  runId: string;
  status: 'failed' | 'succeeded';
  endedAt: Date;
  stepArtifacts: { stepId: string; bucket: string; storageKey: string }[];
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'frg/bctx/end'
});

let buildEndedQueueProcessor = buildEndedQueue.process(async data => {
  await runLock.usingLock(data.runId, async () => {
    let run = await db.workflowRun.findFirst({ where: { id: data.runId } });
    if (!run || run.status == 'succeeded' || run.status == 'failed') return;

    await db.workflowRun.updateMany({
      where: { id: data.runId },
      data: { status: data.status, endedAt: data.endedAt }
    });
    await db.workflowRunStep.updateMany({
      where: { runOid: run.oid, status: 'running' },
      data: { status: data.status, endedAt: data.endedAt }
    });
    await db.workflowRunStep.updateMany({
      where: { runOid: run.oid, status: 'pending' },
      data: { status: 'canceled' }
    });

    if (data.status == 'succeeded') {
      await createArtifactsQueue.add({
        runId: data.runId,
        stepArtifacts: data.stepArtifacts
      });
    }

    await storeOutputQueue.add({ runId: data.runId });
  });
});

let createArtifactsQueue = createQueue<{
  runId: string;
  stepArtifacts: { stepId: string; bucket: string; storageKey: string }[];
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'frg/bctx/patar/many'
});

let createArtifactsQueueProcessor = createArtifactsQueue.process(async data => {
  await createArtifactQueue.addMany(
    data.stepArtifacts.map(sa => ({
      runId: data.runId,
      stepId: sa.stepId,
      bucket: sa.bucket,
      storageKey: sa.storageKey
    }))
  );
});

let createArtifactQueue = createQueue<{
  runId: string;
  stepId: string;
  bucket: string;
  storageKey: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'frg/bctx/patar/single'
});

let createArtifactQueueProcessor = createArtifactQueue.process(async data => {
  let artifact = await db.workflowArtifact.findFirst({
    where: {
      run: { id: data.runId },
      storageKey: data.storageKey
    }
  });
  if (artifact) return;

  try {
    await storage.headObject(data.bucket, data.storageKey);
  } catch {
    // Artifact does not exist in storage
    return;
  }

  let run = await db.workflowRun.findFirst({ where: { id: data.runId } });
  let step = await db.workflowRunStep.findFirst({
    where: { id: data.stepId },
    include: { step: true }
  });
  if (!run || !step) return;

  await workflowArtifactService.putArtifactFromBuilderFinish({
    run,
    name: step.step?.artifactToUploadName || 'artifact',
    type: 'output',
    artifactData: { bucket: data.bucket, storageKey: data.storageKey }
  });
});

let storeOutputQueue = createQueue<{ runId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'frg/bctx/storou'
});

let storeOutputQueueProcessor = storeOutputQueue.process(async data => {
  let run = await db.workflowRun.findFirst({ where: { id: data.runId } });
  if (!run) return;

  let steps = await db.workflowRunStep.findMany({
    where: { runOid: run.oid }
  });

  for (let step of steps) {
    let outputs = await db.workflowRunOutputTemp.findMany({
      where: { stepOid: step.oid },
      orderBy: { createdAt: 'asc' }
    });

    let fullOutput = outputs.map(o => o.output).join('\n');

    let outputBucket = env.storage.LOG_BUCKET_NAME;
    let outputStorageKey = `runs/${run.id}/log/${step.id}`;

    await storage.putObject(outputBucket, outputStorageKey, fullOutput);

    await db.workflowRunStep.updateMany({
      where: { oid: step.oid },
      data: {
        outputBucket,
        outputStorageKey
      }
    });
  }

  await storeOutputCleanupQueue.add({ runOid: run.oid }, { delay: 10000 });
});

let storeOutputCleanupQueue = createQueue<{ runOid: bigint }>({
  redisUrl: env.service.REDIS_URL,
  name: 'frg/bctx/stoclu'
});

let storeOutputCleanupQueueProcessor = storeOutputCleanupQueue.process(async data => {
  await db.workflowRunOutputTemp.deleteMany({
    where: { runOid: data.runOid }
  });

  await db.workflowRun.updateMany({
    where: { oid: data.runOid },
    data: { encryptedEnvironmentVariables: '' }
  });
});

export let buildQueueProcessors = combineQueueProcessors([
  buildEndedQueueProcessor,
  storeOutputQueueProcessor,
  storeOutputCleanupQueueProcessor,
  createArtifactsQueueProcessor,
  createArtifactQueueProcessor
]);
