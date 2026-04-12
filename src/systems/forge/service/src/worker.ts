import { runQueueProcessors } from '@lowerdeck/queue';
import { buildQueueProcessors } from './providers/_lib/queues';
import { awsCodeBuildProcessors } from './providers/aws-codebuild';
import { deleteWorkflowProcessors } from './queues/deleteWorkflow';
import { deleteWorkflowArtifactProcessors } from './queues/deleteWorkflowArtifact';
import { deleteWorkflowRunProcessors } from './queues/deleteWorkflowRun';

await runQueueProcessors([
  deleteWorkflowProcessors,
  deleteWorkflowRunProcessors,
  deleteWorkflowArtifactProcessors,

  awsCodeBuildProcessors,

  buildQueueProcessors
]);
