import type { PrismaClient } from '../../../prisma/generated/client';
import { TenantFixtures } from './tenantFixtures';
import { ProviderFixtures } from './providerFixtures';
import { RuntimeFixtures } from './runtimeFixtures';
import { FunctionFixtures } from './functionFixtures';
import { FunctionBundleFixtures } from './functionBundleFixtures';
import { FunctionVersionFixtures } from './functionVersionFixtures';
import { FunctionDeploymentFixtures } from './functionDeploymentFixtures';
import { FunctionDeploymentStepFixtures } from './functionDeploymentStepFixtures';
import { FunctionInvocationFixtures } from './functionInvocationFixtures';
import { RuntimeForgeWorkflowFixtures } from './runtimeForgeWorkflowFixtures';

export function fixtures(db: PrismaClient) {
  return {
    tenant: TenantFixtures(db),
    provider: ProviderFixtures(db),
    runtime: RuntimeFixtures(db),
    function: FunctionFixtures(db),
    functionBundle: FunctionBundleFixtures(db),
    functionVersion: FunctionVersionFixtures(db),
    functionDeployment: FunctionDeploymentFixtures(db),
    functionDeploymentStep: FunctionDeploymentStepFixtures(db),
    functionInvocation: FunctionInvocationFixtures(db),
    runtimeForgeWorkflow: RuntimeForgeWorkflowFixtures(db)
  };
}

export {
  TenantFixtures,
  ProviderFixtures,
  RuntimeFixtures,
  FunctionFixtures,
  FunctionBundleFixtures,
  FunctionVersionFixtures,
  FunctionDeploymentFixtures,
  FunctionDeploymentStepFixtures,
  FunctionInvocationFixtures,
  RuntimeForgeWorkflowFixtures
};
