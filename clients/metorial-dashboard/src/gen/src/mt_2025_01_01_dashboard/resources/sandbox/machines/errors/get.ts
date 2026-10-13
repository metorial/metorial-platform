import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxMachinesErrorsGetOutput = {
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

export let mapSandboxMachinesErrorsGetOutput =
  mtMap.object<SandboxMachinesErrorsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    machineId: mtMap.objectField('machine_id', mtMap.passthrough()),
    machineInstanceId: mtMap.objectField(
      'machine_instance_id',
      mtMap.passthrough()
    ),
    operationId: mtMap.objectField('operation_id', mtMap.passthrough()),
    eventId: mtMap.objectField('event_id', mtMap.passthrough()),
    kind: mtMap.objectField('kind', mtMap.passthrough()),
    stage: mtMap.objectField('stage', mtMap.passthrough()),
    reason: mtMap.objectField('reason', mtMap.passthrough()),
    code: mtMap.objectField('code', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    exitCode: mtMap.objectField('exit_code', mtMap.passthrough()),
    durationMs: mtMap.objectField('duration_ms', mtMap.passthrough()),
    stdout: mtMap.objectField('stdout', mtMap.passthrough()),
    occurredAt: mtMap.objectField('occurred_at', mtMap.date())
  });

