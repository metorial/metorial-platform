import { v } from '@lowerdeck/validation';
import { mapSandboxFailure } from '@metorial/module-sandbox';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineOperationType } from '../../types';
import { sandboxFailureSchema, toRawFailure } from './_shared';

export let v1SandboxMachineOperationPresenter = Presenter.create(sandboxMachineOperationType)
  .presenter(async ({ operation }) => ({
    object: 'sandbox.machine.operation' as const,

    id: operation.id,
    machine_id: operation.machineId,
    kind: operation.kind,
    trigger: operation.trigger,
    outcome: operation.outcome,
    failure: mapSandboxFailure(toRawFailure(operation.failure)),

    from_machine_instance_id: operation.fromInstanceId,
    superseded_by_id: operation.supersededById,
    instance_operations: operation.instanceOperations.map(child => ({
      id: child.id,
      kind: child.kind as string,
      machine_instance_id: child.instanceId
    })),

    requested_at: operation.requestedAt,
    completed_at: operation.completedAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.operation', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The operation's unique identifier" }),
      machine_id: v.string({ description: 'The machine the operation acts on' }),
      kind: v.enumOf(['start', 'pause', 'hibernate', 'restart', 'terminate'], {
        description: 'What the operation does to the machine'
      }),
      trigger: v.enumOf(
        [
          'api',
          'access',
          'idle_policy',
          'paused_policy',
          'lifetime',
          'failure',
          'platform',
          'update'
        ],
        { description: 'What requested the operation' }
      ),
      outcome: v.enumOf(['active', 'completed', 'superseded', 'failed'], {
        description: "The operation's outcome"
      }),
      failure: v.nullable(sandboxFailureSchema),

      from_machine_instance_id: v.nullable(
        v.string({
          description: 'The instance the machine was running on when the operation began'
        })
      ),
      superseded_by_id: v.nullable(
        v.string({ description: 'The operation that replaced this one' })
      ),
      instance_operations: v.array(
        v.object({
          id: v.string(),
          kind: v.string(),
          machine_instance_id: v.string()
        }),
        { description: 'The per-instance steps the operation consisted of' }
      ),

      requested_at: v.date(),
      completed_at: v.nullable(v.date())
    })
  )
  .build();
