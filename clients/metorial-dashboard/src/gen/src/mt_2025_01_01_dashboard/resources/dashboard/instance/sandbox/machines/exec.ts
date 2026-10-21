import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesExecOutput = {
  object: 'sandbox.machine.exec_result';
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
};

export let mapDashboardInstanceSandboxMachinesExecOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesExecOutput>([
    'exit_code',
    'timed_out',
    'stdout_truncated',
    'stderr_truncated'
  ]);

export type DashboardInstanceSandboxMachinesExecBody = {
  command: string;
  cwd?: string | undefined;
  env?: Record<string, string> | undefined;
  timeoutSeconds?: number | undefined;
};

export let mapDashboardInstanceSandboxMachinesExecBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesExecBody>([
    'timeout_seconds'
  ]);
