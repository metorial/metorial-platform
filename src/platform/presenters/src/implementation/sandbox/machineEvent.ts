import { v } from '@lowerdeck/validation';
import { mapSandboxFailure } from '@metorial/module-sandbox';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineEventType } from '../../types';
import { sandboxFailureSchema, toRawFailure } from './_shared';

let publicSources = ['agent', 'api', 'policy', 'guest', 'system'] as const;

let statusChangeSchema = v.nullable(
  v.object({
    from_status: v.nullable(v.string()),
    to_status: v.string()
  })
);

export let v1SandboxMachineEventPresenter = Presenter.create(sandboxMachineEventType)
  .presenter(async ({ event }) => ({
    object: 'sandbox.machine.event' as const,

    id: event.id,
    machine_id: event.machineId,
    machine_instance_id: event.instanceId,
    generation: event.generation,

    type: event.type as string,
    source:
      event.source == 'platform' || event.source == 'controller' ? 'system' : event.source,
    machine: event.machine
      ? {
          from_status: event.machine.fromStatus as string | null,
          to_status: event.machine.toStatus as string
        }
      : null,
    instance: event.instance
      ? {
          from_status: event.instance.fromStatus as string | null,
          to_status: event.instance.toStatus as string
        }
      : null,

    operation_id: event.machineOperationId,
    guest_error_id: event.guestErrorId,
    error: mapSandboxFailure(toRawFailure(event.error)),

    occurred_at: event.occurredAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.event', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The event's unique identifier" }),
      machine_id: v.string({ description: 'The machine the event happened on' }),
      machine_instance_id: v.nullable(
        v.string({
          description: 'The instance the event happened on, for instance-level events'
        })
      ),
      generation: v.nullable(
        v.number({ description: 'The generation of the instance the event happened on' })
      ),

      type: v.string({
        description: "The event's type",
        examples: ['machine_running', 'machine_paused']
      }),
      source: v.enumOf([...publicSources], {
        description: 'What caused the event'
      }),
      machine: statusChangeSchema,
      instance: statusChangeSchema,

      operation_id: v.nullable(
        v.string({ description: 'The operation the event belongs to' })
      ),
      guest_error_id: v.nullable(
        v.string({ description: 'The guest error recorded with the event' })
      ),
      error: v.nullable(sandboxFailureSchema),

      occurred_at: v.date()
    })
  )
  .build();
