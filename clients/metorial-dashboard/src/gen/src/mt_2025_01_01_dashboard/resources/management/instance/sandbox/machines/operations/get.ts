import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesOperationsGetOutput = {
  object: 'sandbox.machine.operation';
  id: string;
  machineId: string;
  kind:
    | 'start'
    | 'pause'
    | 'hibernate'
    | 'restart'
    | 'terminate'
    | 'update'
    | 'upgrade';
  trigger:
    | 'api'
    | 'access'
    | 'idle_policy'
    | 'paused_policy'
    | 'lifetime'
    | 'failure'
    | 'platform'
    | 'update';
  outcome: 'active' | 'completed' | 'superseded' | 'failed';
  failure: {
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
  fromMachineInstanceId: string | null;
  supersededById: string | null;
  instanceOperations: { id: string; kind: string; machineInstanceId: string }[];
  requestedAt: Date;
  completedAt: Date | null;
};

export let mapManagementInstanceSandboxMachinesOperationsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesOperationsGetOutput>(
    [
      'machine_id',
      'from_machine_instance_id',
      'superseded_by_id',
      ['instance_operations', 1, [2, [1, ['machine_instance_id']]]],
      'requested_at',
      'completed_at'
    ],
    1
  );
