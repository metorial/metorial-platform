import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesEventsGetOutput = {
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

export let mapManagementInstanceSandboxMachinesEventsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesEventsGetOutput>(
    [
      'machine_id',
      'machine_instance_id',
      ['machine', 0, [1, ['from_status', 'to_status']]],
      ['instance', 0, [1, ['from_status', 'to_status']]],
      'operation_id',
      'guest_error_id',
      'occurred_at'
    ],
    1
  );
