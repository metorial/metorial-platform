import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesExecOutput = {
  object: 'sandbox.machine.exec_result';
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
};

export let mapSandboxMachinesExecOutput =
  /* @__PURE__ */ mapObject<SandboxMachinesExecOutput>([
    'exit_code',
    'timed_out',
    'stdout_truncated',
    'stderr_truncated'
  ]);

export type SandboxMachinesExecBody = {
  command: string;
  cwd?: string | undefined;
  env?: Record<string, string> | undefined;
  timeoutSeconds?: number | undefined;
};

export let mapSandboxMachinesExecBody =
  /* @__PURE__ */ mapObject<SandboxMachinesExecBody>(['timeout_seconds']);
