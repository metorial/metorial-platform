import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { subDays } from 'date-fns';
import { db } from '../db';
import { env } from '../env';
import { deleteWorkflowArtifactsQueue } from './deleteWorkflowArtifact';
import { deleteWorkflowRunsQueue } from './deleteWorkflowRun';

export let deleteWorkflowQueue = createQueue<{ workflowId: string }>({
  redisUrl: env.service.REDIS_URL,
  name: 'forge/del-wfl',
  workerOpts: {
    concurrency: 1
  }
});

let deleteWorkflowQueueProcessor = deleteWorkflowQueue.process(async data => {
  await deleteWorkflowArtifactsQueue.add({
    workflowId: data.workflowId
  });
  await deleteWorkflowRunsQueue.add({
    workflowId: data.workflowId
  });

  await db.workflow.updateMany({
    where: { id: data.workflowId },
    data: { status: 'deleted', deletedAt: new Date() }
  });
});

let workflowCleanupCronProcessor = createCron(
  {
    redisUrl: env.service.REDIS_URL,
    name: 'forge/wfl-cleanup',
    cron: '0 * * * *'
  },
  async () => {
    let oneDayAgo = subDays(new Date(), 1);

    await db.workflow.deleteMany({
      where: {
        status: 'deleted',
        deletedAt: { lt: oneDayAgo }
      }
    });
  }
);

export let deleteWorkflowProcessors = combineQueueProcessors([
  deleteWorkflowQueueProcessor,
  workflowCleanupCronProcessor
]);
