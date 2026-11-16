import type { Workflow, WorkflowArtifact, WorkflowRun } from '../../prisma/generated/client';
import { storage } from '../storage';

export let workflowArtifactPresenter = async (
  artifact: WorkflowArtifact & { run: WorkflowRun; workflow: Workflow }
) => ({
  object: 'forge#workflow.artifact',

  id: artifact.id,

  name: artifact.name,
  type: artifact.type,

  runId: artifact.run.id,
  workflowId: artifact.workflow.id,

  url: await storage.getPublicURL(artifact.bucket, artifact.storageKey),

  createdAt: artifact.createdAt
});
