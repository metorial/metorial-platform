import type {
  DashboardInstanceSandboxImageBuildsLogsOutput,
  DashboardInstanceSandboxImageBuildsLogsQuery,
  DashboardInstanceSandboxMachinesInstancesLogsOutput,
  DashboardInstanceSandboxMachinesInstancesLogsQuery
} from '@metorial/dashboard-sdk';
import { isMetorialSDKError } from '@metorial/util-endpoint';
import { withAuth } from '../../user';

let logsNotFoundEntity = 'sandbox_log_stream';

export type SandboxLogPage = DashboardInstanceSandboxImageBuildsLogsOutput &
  DashboardInstanceSandboxMachinesInstancesLogsOutput;

export type SandboxLogLine = SandboxLogPage['lines'][number];

export type SandboxLogQuery = DashboardInstanceSandboxImageBuildsLogsQuery &
  DashboardInstanceSandboxMachinesInstancesLogsQuery & {
    signal?: AbortSignal;
  };

let createAbortError = () => new DOMException('The log request was aborted', 'AbortError');

let throwIfAborted = (signal: AbortSignal | undefined) => {
  if (signal?.aborted) throw createAbortError();
};

export let fetchSandboxImageBuildLogs = async (
  input: {
    instanceId: string;
    buildId: string;
  } & SandboxLogQuery
): Promise<SandboxLogPage> => {
  let { instanceId, buildId, signal, ...query } = input;

  throwIfAborted(signal);
  let page = await withAuth(sdk => sdk.sandbox.imageBuilds.logs(instanceId, buildId, query));
  throwIfAborted(signal);

  return page;
};

export let fetchSandboxMachineInstanceLogs = async (
  input: {
    instanceId: string;
    machineId: string;
    machineInstanceId: string;
  } & SandboxLogQuery
): Promise<SandboxLogPage> => {
  let { instanceId, machineId, machineInstanceId, signal, ...query } = input;

  throwIfAborted(signal);
  let page = await withAuth(sdk =>
    sdk.sandbox.machines.instances.logs(instanceId, machineId, machineInstanceId, query)
  );
  throwIfAborted(signal);

  return page;
};

export let isSandboxLogsUnavailableError = (error: unknown) =>
  isMetorialSDKError(error) &&
  error.response.status == 404 &&
  error.response.entity == logsNotFoundEntity;
