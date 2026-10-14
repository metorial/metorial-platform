import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesErrorsGetOutput = {
  object: 'sandbox.machine.error';
  id: string;
  machineId: string;
  machineInstanceId: string;
  operationId: string;
  eventId: string | null;
  kind: string;
  stage: 'prepare' | 'initialize';
  reason: 'failed' | 'timed_out';
  code: string;
  message: string;
  exitCode: number | null;
  durationMs: number | null;
  stdout: string | null;
  occurredAt: Date;
};

export let mapManagementInstanceSandboxMachinesErrorsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesErrorsGetOutput>(
    [
      'machine_id',
      'machine_instance_id',
      'operation_id',
      'event_id',
      'exit_code',
      'duration_ms',
      'occurred_at'
    ],
    1
  );
