import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesOperationsListOutput = {
  items: {
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
    instanceOperations: {
      id: string;
      kind: string;
      machineInstanceId: string;
    }[];
    requestedAt: Date;
    completedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSandboxMachinesOperationsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxMachinesOperationsListOutput>(
    [
      7,
      [
        1,
        [
          'machine_id',
          'from_machine_instance_id',
          'superseded_by_id',
          ['instance_operations', 1, [2, [1, ['machine_instance_id']]]],
          'requested_at',
          'completed_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSandboxMachinesOperationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  machineInstanceId?: string | string[] | undefined;
  kind?:
    | 'start'
    | 'pause'
    | 'hibernate'
    | 'restart'
    | 'terminate'
    | ('start' | 'pause' | 'hibernate' | 'restart' | 'terminate')[]
    | undefined;
  trigger?:
    | 'api'
    | 'access'
    | 'idle_policy'
    | 'paused_policy'
    | 'lifetime'
    | 'failure'
    | 'platform'
    | 'update'
    | (
        | 'api'
        | 'access'
        | 'idle_policy'
        | 'paused_policy'
        | 'lifetime'
        | 'failure'
        | 'platform'
        | 'update'
      )[]
    | undefined;
  outcome?:
    | 'active'
    | 'completed'
    | 'superseded'
    | 'failed'
    | ('active' | 'completed' | 'superseded' | 'failed')[]
    | undefined;
};

export let mapManagementInstanceSandboxMachinesOperationsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxMachinesOperationsListQuery>(
    [3, [[0, [1, ['machine_instance_id']]]]]
  );
