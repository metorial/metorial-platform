import type {
  Function,
  FunctionDeployment,
  FunctionDeploymentStep,
  FunctionDeploymentStepStatus,
  FunctionDeploymentStepType,
  FunctionVersion,
  Provider,
  Runtime
} from '../../prisma/generated/client';
import { functionPresenter } from './function';
import { functionVersionPresenter } from './functionVersion';
import { runtimePresenter } from './runtime';

export let functionDeploymentPresenter = (
  deployment: FunctionDeployment & {
    function: Function & {
      currentVersion: FunctionVersion | null;
    };
    runtime: Runtime & {
      provider: Provider;
    };
    functionVersion: FunctionVersion | null;
    steps: FunctionDeploymentStep[];
  }
) => ({
  object: 'function_bay#function.deployment',

  id: deployment.id,
  status: deployment.status,

  error: deployment.errorCode
    ? {
        code: deployment.errorCode,
        message: deployment.errorMessage ?? deployment.errorCode
      }
    : null,

  identifier: deployment.identifier,
  name: deployment.name,

  configuration: deployment.configuration,

  function: functionPresenter(deployment.function),
  runtime: runtimePresenter(deployment.runtime),
  version: deployment.functionVersion
    ? functionVersionPresenter({
        ...deployment.functionVersion,
        function: deployment.function,
        runtime: deployment.runtime
      })
    : null,

  createdAt: deployment.createdAt
});

export let functionDeploymentStepPresenter = (step: {
  id: string;
  name: string;
  type: FunctionDeploymentStepType | 'build';
  status: FunctionDeploymentStepStatus;
  logs: { timestamp: number; message: string }[];
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}) => ({
  object: 'function_bay#function.deployment.step',

  id: step.id,
  status: step.status,
  name: step.name,

  logs: step.logs,
  type: step.type,

  createdAt: step.createdAt,
  startedAt: step.startedAt,
  endedAt: step.endedAt
});
