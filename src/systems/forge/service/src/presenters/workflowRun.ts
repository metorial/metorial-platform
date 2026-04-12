import type {
  Workflow,
  WorkflowArtifact,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowVersion,
  WorkflowVersionStep
} from '../../prisma/generated/client';
import { workflowArtifactPresenter } from './workflowArtifact';
import { workflowVersionStepPresenter } from './workflowVersion';

export let workflowRunPresenter = async (
  run: WorkflowRun & {
    workflow: Workflow;
    version: WorkflowVersion;
    steps: (WorkflowRunStep & {
      step:
        | (WorkflowVersionStep & {
            artifactToDownload: WorkflowArtifact | null;
          })
        | null;
    })[];
    artifacts: WorkflowArtifact[];
  }
) => ({
  object: 'forgeworkflow.run',

  id: run.id,
  status: run.status,

  workflowId: run.workflow.id,
  version: run.version.id,

  artifacts: await Promise.all(
    run.artifacts.map(a =>
      workflowArtifactPresenter({
        ...a,
        run,
        workflow: run.workflow
      })
    )
  ),

  steps: run.steps.sort((a, b) => a.index - b.index).map(workflowRunStepPresenter),

  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  startedAt: run.startedAt,
  endedAt: run.endedAt
});

export let workflowRunStepPresenter = (
  step: WorkflowRunStep & {
    step:
      | (WorkflowVersionStep & {
          artifactToDownload: WorkflowArtifact | null;
        })
      | null;
  }
) => ({
  object: 'forge#workflow.run.step',

  id: step.id,

  type: step.type,
  name: step.name,
  status: step.status,

  createdAt: step.createdAt,
  startedAt: step.startedAt,
  endedAt: step.endedAt,

  step: step.step ? workflowVersionStepPresenter(step.step) : null
});
