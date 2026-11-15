import { combineQueueProcessors, createQueue, type IQueue, type IQueueProcessor } from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';
import { storage } from '../storage';

export let deleteWorkflowRunsQueue: IQueue<{ cursor?: string; workflowId: string }, any> = createQueue<{
  cursor?: string;
  workflowId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'forge/del-runs',
  workerOpts: {
    concurrency: 1
  }
});

let deleteWorkflowRunsQueueProcessor = deleteWorkflowRunsQueue.process(async data => {
  let currentSet = await db.workflowRun.findMany({
    where: {
      workflow: { id: data.workflowId },
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: 100
  });

  if (currentSet.length === 0) return;

  await deleteWorkflowRunQueue.addMany(
    currentSet.map(run => ({
      runId: run.id
    }))
  );

  let lastRun = currentSet[currentSet.length - 1];
  if (lastRun) {
    await deleteWorkflowRunsQueue.add({
      workflowId: data.workflowId,
      cursor: lastRun.id
    });
  }
});

export let deleteWorkflowRunQueue: IQueue<{ runId: string }, any> = createQueue<{
  runId: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'forge/del-run',
  workerOpts: {
    concurrency: 1
  }
});

let deleteWorkflowRunQueueProcessor = deleteWorkflowRunQueue.process(async data => {
  let steps = await db.workflowRunStep.findMany({
    where: { run: { id: data.runId } }
  });

  await db.workflowRun.delete({ where: { id: data.runId } });

  for (let step of steps) {
    if (step.outputBucket && step.outputStorageKey) {
      await deleteWorkflowRunStorageQueue.add({
        storageKey: step.outputStorageKey,
        bucket: step.outputBucket
      });
    }
  }
});

export let deleteWorkflowRunStorageQueue: IQueue<{
  storageKey: string;
  bucket: string;
}, any> = createQueue<{
  storageKey: string;
  bucket: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'forge/del-run-storage',
  workerOpts: {
    concurrency: 1
  }
});

let deleteWorkflowRunStorageQueueProcessor = deleteWorkflowRunStorageQueue.process(
  async data => {
    await storage.deleteObject(data.bucket, data.storageKey);
  }
);

export let deleteWorkflowRunProcessors: IQueueProcessor = combineQueueProcessors([
  deleteWorkflowRunsQueueProcessor,
  deleteWorkflowRunQueueProcessor,
  deleteWorkflowRunStorageQueueProcessor
]);
