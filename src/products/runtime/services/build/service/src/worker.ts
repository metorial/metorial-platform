import { runQueueProcessors } from '@lowerdeck/queue';
import { buildProviderProcessors } from './providers';
import { buildQueueProcessors } from './providers/_lib/queues';
import { deleteWorkflowProcessors } from './queues/deleteWorkflow';
import { deleteWorkflowArtifactProcessors } from './queues/deleteWorkflowArtifact';
import { deleteWorkflowRunProcessors } from './queues/deleteWorkflowRun';

await runQueueProcessors([
  deleteWorkflowProcessors,
  deleteWorkflowRunProcessors,
  deleteWorkflowArtifactProcessors,
  buildProviderProcessors,
  buildQueueProcessors
]);
