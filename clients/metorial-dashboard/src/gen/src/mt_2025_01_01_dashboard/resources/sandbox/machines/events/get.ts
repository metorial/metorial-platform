import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxMachinesEventsGetOutput = {
  object: 'sandbox.machine.event';
  id: string;
  machineId: string;
  machineInstanceId: string | null;
  generation: number | null;
  type: string;
  source: 'agent' | 'api' | 'policy' | 'guest' | 'system';
  machine: { fromStatus: string | null; toStatus: string } | null;
  instance: { fromStatus: string | null; toStatus: string } | null;
  operationId: string | null;
  guestErrorId: string | null;
  error: {
    code:
      | 'provision_failed'
      | 'start_failed'
      | 'disk_unavailable'
      | 'image_unavailable'
      | 'resize_failed'
      | 'timeout'
      | 'cancelled'
      | 'internal_error';
    message: string;
  } | null;
  occurredAt: Date;
};

export let mapSandboxMachinesEventsGetOutput =
  mtMap.object<SandboxMachinesEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    machineId: mtMap.objectField('machine_id', mtMap.passthrough()),
    machineInstanceId: mtMap.objectField(
      'machine_instance_id',
      mtMap.passthrough()
    ),
    generation: mtMap.objectField('generation', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    machine: mtMap.objectField(
      'machine',
      mtMap.object({
        fromStatus: mtMap.objectField('from_status', mtMap.passthrough()),
        toStatus: mtMap.objectField('to_status', mtMap.passthrough())
      })
    ),
    instance: mtMap.objectField(
      'instance',
      mtMap.object({
        fromStatus: mtMap.objectField('from_status', mtMap.passthrough()),
        toStatus: mtMap.objectField('to_status', mtMap.passthrough())
      })
    ),
    operationId: mtMap.objectField('operation_id', mtMap.passthrough()),
    guestErrorId: mtMap.objectField('guest_error_id', mtMap.passthrough()),
    error: mtMap.objectField(
      'error',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough())
      })
    ),
    occurredAt: mtMap.objectField('occurred_at', mtMap.date())
  });

