import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';
import { storage } from '../storage';

export let deleteWorkflowArtifactsQueue = createQueue<{ cursor?: string; workflowId: string }>(
  {
    redisUrl: env.service.REDIS_URL,
    name: 'forge/del-artifacts',
    workerOpts: {
      concurrency: 1
    }
  }
);

let deleteWorkflowArtifactsQueueProcessor = deleteWorkflowArtifactsQueue.process(
  async data => {
    let currentSet = await db.workflowArtifact.findMany({
      where: {
        workflow: { id: data.workflowId },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100
    });

    if (currentSet.length === 0) return;

    await deleteWorkflowArtifactQueue.addMany(
      currentSet.map(artifact => ({
        artifactId: artifact.id
      }))
    );

    let lastArtifact = currentSet[currentSet.length - 1];
    if (lastArtifact) {
      await deleteWorkflowArtifactsQueue.add({
        workflowId: data.workflowId,
        cursor: lastArtifact.id
      });
    }
  }
);

export let deleteWorkflowArtifactQueue = createQueue<{ artifactId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'forge/del-artifact',
  workerOpts: {
    concurrency: 1
  }
});

let deleteWorkflowArtifactQueueProcessor = deleteWorkflowArtifactQueue.process(async data => {
  let res = await db.workflowArtifact.delete({ where: { id: data.artifactId } });
  await deleteWorkflowArtifactStorageQueue.add({
    storageKey: res.storageKey,
    bucket: res.bucket
  });
});

export let deleteWorkflowArtifactStorageQueue = createQueue<{
  storageKey: string;
  bucket: string;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'forge/del-artifact-storage',
  workerOpts: {
    concurrency: 1
  }
});

let deleteWorkflowArtifactStorageQueueProcessor = deleteWorkflowArtifactStorageQueue.process(
  async data => {
    await storage.deleteObject(data.bucket, data.storageKey);
  }
);

export let deleteWorkflowArtifactProcessors = combineQueueProcessors([
  deleteWorkflowArtifactsQueueProcessor,
  deleteWorkflowArtifactQueueProcessor,
  deleteWorkflowArtifactStorageQueueProcessor
]);
