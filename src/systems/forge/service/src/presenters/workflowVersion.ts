import type {
  Workflow,
  WorkflowArtifact,
  WorkflowVersion,
  WorkflowVersionStep
} from '../../prisma/generated/client';

export let workflowVersionPresenter = (
  version: WorkflowVersion & {
    steps: (WorkflowVersionStep & {
      artifactToDownload: WorkflowArtifact | null;
    })[];
    workflow: Workflow;
  }
) => ({
  object: 'forge#workflow.version',

  id: version.id,
  identifier: version.identifier,
  name: version.name,

  workflowId: version.workflow.id,

  steps: version.steps.sort((a, b) => a.index - b.index).map(workflowVersionStepPresenter),

  createdAt: version.createdAt
});

export let workflowVersionStepPresenter = (
  step: WorkflowVersionStep & {
    artifactToDownload: WorkflowArtifact | null;
  }
) => ({
  object: 'forge#workflow.version.step',

  id: step.id,
  type: step.type,
  name: step.name,

  initScript: step.initScript,
  actionScript: step.actionScript,
  cleanupScript: step.cleanupScript,

  artifactId: step.artifactToDownload ? step.artifactToDownload.id : undefined,
  artifactDestinationPath: step.artifactToDownload ? step.artifactToDownload.name : undefined,

  artifactSourcePath: step.artifactToUploadPath,
  artifactName: step.artifactToUploadName,

  createdAt: step.createdAt
});
