import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineErrorType } from '../../types';

export let v1SandboxMachineErrorPresenter = Presenter.create(sandboxMachineErrorType)
  .presenter(async ({ error }) => ({
    object: 'sandbox.machine.error' as const,

    id: error.id,
    machine_id: error.machineId,
    machine_instance_id: error.instanceId,
    operation_id: error.operationId,
    event_id: error.eventId,

    kind: error.kind as string,
    stage: error.stage,
    reason: error.reason,

    code: error.code,
    message: error.message,
    exit_code: error.exitCode,
    duration_ms: error.durationMs,
    stdout: error.stdout,

    occurred_at: error.occurredAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.error', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The error's unique identifier" }),
      machine_id: v.string(),
      machine_instance_id: v.string({ description: 'The instance the error occurred in' }),
      operation_id: v.string({ description: 'The operation during which the error occurred' }),
      event_id: v.nullable(v.string()),

      kind: v.string({ description: 'The kind of operation that was running' }),
      stage: v.enumOf(['prepare', 'initialize'], {
        description: 'The stage of the operation at which the error occurred'
      }),
      reason: v.enumOf(['failed', 'timed_out'], {
        description: 'Why the stage did not complete'
      }),

      code: v.string({ description: 'The error code reported from inside the machine' }),
      message: v.string({ description: 'The error message reported from inside the machine' }),
      exit_code: v.nullable(v.number({ description: 'The exit code of the failing process' })),
      duration_ms: v.nullable(v.number({ description: 'How long the process ran' })),
      stdout: v.nullable(v.string({ description: 'Standard output of the failing process' })),

      occurred_at: v.date()
    })
  )
  .build();
