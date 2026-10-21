import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesExecOutput = {
  object: 'sandbox.machine.exec_result';
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
};

export let mapManagementInstanceSandboxMachinesExecOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesExecOutput>([
    'exit_code',
    'timed_out',
    'stdout_truncated',
    'stderr_truncated'
  ]);

export type ManagementInstanceSandboxMachinesExecBody = {
  command: string;
  cwd?: string | undefined;
  env?: Record<string, string> | undefined;
  timeoutSeconds?: number | undefined;
};

export let mapManagementInstanceSandboxMachinesExecBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesExecBody>([
    'timeout_seconds'
  ]);
