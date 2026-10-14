import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesErrorsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSandboxMachinesErrorsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxMachinesErrorsListOutput>(
    [
      7,
      [
        1,
        [
          'machine_id',
          'machine_instance_id',
          'operation_id',
          'event_id',
          'exit_code',
          'duration_ms',
          'occurred_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSandboxMachinesErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { machineInstanceId?: string | string[] | undefined };

export let mapManagementInstanceSandboxMachinesErrorsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxMachinesErrorsListQuery>(
    [3, [[0, [1, ['machine_instance_id']]]]]
  );
