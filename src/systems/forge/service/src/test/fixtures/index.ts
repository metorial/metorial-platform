import type { PrismaClient } from '../../../prisma/generated/client';
import { TenantFixtures } from './tenantFixtures';
import { ProviderFixtures } from './providerFixtures';
import { WorkflowFixtures } from './workflowFixtures';
import { WorkflowVersionFixtures } from './workflowVersionFixtures';
import { WorkflowVersionStepFixtures } from './workflowVersionStepFixtures';
import { WorkflowRunFixtures } from './workflowRunFixtures';
import { WorkflowRunStepFixtures } from './workflowRunStepFixtures';
import { WorkflowArtifactFixtures } from './workflowArtifactFixtures';

export function fixtures(db: PrismaClient) {
  return {
    tenant: TenantFixtures(db),
    provider: ProviderFixtures(db),
    workflow: WorkflowFixtures(db),
    workflowVersion: WorkflowVersionFixtures(db),
    workflowVersionStep: WorkflowVersionStepFixtures(db),
    workflowRun: WorkflowRunFixtures(db),
    workflowRunStep: WorkflowRunStepFixtures(db),
    workflowArtifact: WorkflowArtifactFixtures(db)
  };
}

export {
  TenantFixtures,
  ProviderFixtures,
  WorkflowFixtures,
  WorkflowVersionFixtures,
  WorkflowVersionStepFixtures,
  WorkflowRunFixtures,
  WorkflowRunStepFixtures,
  WorkflowArtifactFixtures
};
