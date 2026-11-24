import { createLock } from '@lowerdeck/lock';
import {
  combineQueueProcessors,
  createQueue,
  type IQueue,
  type IQueueProcessor
} from '@lowerdeck/queue';
import { db, withTransaction } from '../../db';
import { env } from '../../env';
import { reportBuildFailure } from '../../lib/reportBuildFailure';
import { workflowArtifactService } from '../../services';
import { storage } from '../../storage';

let runLock = createLock({
  name: 'frg/bctx/runlock',
  redisUrl: env.service.REDIS_URL
});

type BuildEnded = {
  runId: string;
  status: 'failed' | 'succeeded';
  endedAt: Date;
  failure?: { code: string; message: string };
  infrastructureFailure?: { code: string; message: string };
  stepArtifacts: { stepId: string; bucket: string; storageKey: string }[];
};

export let buildEndedQueue: IQueue<BuildEnded, any> = createQueue<BuildEnded>({
  redisUrl: env.service.REDIS_URL,
  name: 'frg/bctx/end',
  workerOpts: { concurrency: 50 }
});

let buildEndedQueueProcessor = buildEndedQueue.process(async data => {
  await runLock.usingLock(data.runId, async () => {
    let { status, timing } = await withTransaction(async () => {
      let run = await db.workflowRun.findFirst({ where: { id: data.runId } });
      if (!run || run.status === 'succeeded' || run.status === 'failed')
        return { status: run?.status };

      await db.workflowRun.update({
        where: { oid: run.oid },
        data: {
          status: data.status,
          endedAt: data.endedAt,
          pendingReason: null,
          failureCode: data.failure?.code,
          failureReason: data.failure?.message
        }
      });
      await db.workflowRunStep.updateMany({
        where: { runOid: run.oid, status: 'running' },
        data: { status: data.status, endedAt: data.endedAt }
      });
      if (data.failure) {
        await db.workflowRunStep.updateMany({
          where: { runOid: run.oid, type: 'setup', status: 'pending' },
          data: { status: 'failed', endedAt: data.endedAt }
        });
      }
      await db.workflowRunStep.updateMany({
        where: { runOid: run.oid, status: 'pending' },
        data: { status: 'canceled' }
      });
      let queuedAt = run.kubernetesQueuedAt?.getTime();
      let admittedAt = run.kubernetesAdmittedAt?.getTime();
      let startedAt = run.startedAt?.getTime();
      let timing =
        queuedAt == null
          ? undefined
          : {
              queueWaitMs: (admittedAt ?? data.endedAt.getTime()) - queuedAt,
              timeToStartMs: startedAt == null ? null : startedAt - queuedAt
            };

      return { status: data.status, timing };
    });

    if (timing) {
      console.info('Kubernetes build finished', {
        runId: data.runId,
        status,
        failureCode: data.failure?.code,
        ...timing
      });
    }
    if (status !== data.status) return;

    let failure = data.failure ?? data.infrastructureFailure;
    if (status === 'failed' && failure) {
      await reportBuildFailure({ runId: data.runId, failure }).catch(error =>
        console.error('Could not report build failure', error)
      );
    }

    if (status === 'succeeded') {
      await createArtifactsQueue.add(
        { runId: data.runId, stepArtifacts: data.stepArtifacts },
        { id: data.runId }
      );
    }
    await storeOutputQueue.add({ runId: data.runId }, { id: data.runId });
  });
});

let createArtifactsQueue = createQueue<{
  runId: string;
  stepArtifacts: { stepId: string; bucket: string; storageKey: string }[];
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'frg/bctx/patar/many',
  workerOpts: { concurrency: 1 }
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
  name: 'frg/bctx/patar/single',
  workerOpts: { concurrency: 50 }
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
  name: 'frg/bctx/storou',
  workerOpts: { concurrency: 50 }
});

let storeOutputQueueProcessor = storeOutputQueue.process(async data => {
  let run = await db.workflowRun.findFirst({ where: { id: data.runId } });
  if (!run) return;

  let steps = await db.workflowRunStep.findMany({
    where: { runOid: run.oid }
  });

  for (let step of steps) {
    if (step.outputStorageKey) continue;

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
  name: 'frg/bctx/stoclu',
  workerOpts: { concurrency: 50 }
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

export let buildQueueProcessors: IQueueProcessor = combineQueueProcessors([
  buildEndedQueueProcessor,
  storeOutputQueueProcessor,
  storeOutputCleanupQueueProcessor,
  createArtifactsQueueProcessor,
  createArtifactQueueProcessor
]);
