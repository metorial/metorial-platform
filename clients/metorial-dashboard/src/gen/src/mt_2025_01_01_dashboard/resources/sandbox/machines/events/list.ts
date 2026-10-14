import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesEventsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSandboxMachinesEventsListOutput =
  /* @__PURE__ */ createMapper<SandboxMachinesEventsListOutput>(
    [
      7,
      [
        1,
        [
          'machine_id',
          'machine_instance_id',
          ['machine', 0, [1, ['from_status', 'to_status']]],
          ['instance', 0, [1, ['from_status', 'to_status']]],
          'operation_id',
          'guest_error_id',
          'occurred_at'
        ]
      ]
    ],
    1
  );

export type SandboxMachinesEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  scope?: 'all' | 'machine' | 'instance' | undefined;
  machineInstanceId?: string | string[] | undefined;
  type?:
    | 'running'
    | 'failed'
    | 'paused'
    | 'terminated'
    | 'start_requested'
    | 'start_platform_pending'
    | 'start_platform_complete'
    | 'start_initialize_pending'
    | 'pause_requested'
    | 'pause_prepare_pending'
    | 'pause_prepare_complete'
    | 'pause_platform_pending'
    | 'resume_requested'
    | 'resume_platform_pending'
    | 'resume_platform_complete'
    | 'resume_initialize_pending'
    | 'terminate_requested'
    | 'terminate_prepare_pending'
    | 'terminate_prepare_complete'
    | 'terminate_platform_pending'
    | 'operation_superseded'
    | 'operation_aborted'
    | 'prepare_skipped'
    | 'guest_hook_started'
    | 'guest_error'
    | 'platform_error'
    | 'platform_hook_reported'
    | 'microvm_attached'
    | 'step_redriven'
    | 'machine_starting'
    | 'machine_running'
    | 'machine_pausing'
    | 'machine_paused'
    | 'machine_resuming'
    | 'machine_hibernating'
    | 'machine_hibernated'
    | 'machine_restarting'
    | 'machine_upgrading'
    | 'machine_terminating'
    | 'machine_terminated'
    | 'machine_failed'
    | 'rootfs_selected'
    | 'rootfs_ready'
    | 'rootfs_failed'
    | 'rootfs_activated'
    | 'rootfs_cancelled'
    | 'rootfs_deleted'
    | 'machine_created'
    | 'machine_updated'
    | 'machine_policy_updated'
    | 'machine_operation_superseded'
    | 'instance_created'
    | 'instance_expiring'
    | 'machine_disk_attached'
    | 'machine_disk_detached'
    | 'disk_wait_started'
    | 'disk_wait_ended'
    | 'recovery_scheduled'
    | 'runtime_setup_started'
    | 'runtime_setup_succeeded'
    | 'runtime_setup_failed'
    | 'runtime_entrypoint_started'
    | 'runtime_entrypoint_exited'
    | 'runtime_failed'
    | (
        | 'running'
        | 'failed'
        | 'paused'
        | 'terminated'
        | 'start_requested'
        | 'start_platform_pending'
        | 'start_platform_complete'
        | 'start_initialize_pending'
        | 'pause_requested'
        | 'pause_prepare_pending'
        | 'pause_prepare_complete'
        | 'pause_platform_pending'
        | 'resume_requested'
        | 'resume_platform_pending'
        | 'resume_platform_complete'
        | 'resume_initialize_pending'
        | 'terminate_requested'
        | 'terminate_prepare_pending'
        | 'terminate_prepare_complete'
        | 'terminate_platform_pending'
        | 'operation_superseded'
        | 'operation_aborted'
        | 'prepare_skipped'
        | 'guest_hook_started'
        | 'guest_error'
        | 'platform_error'
        | 'platform_hook_reported'
        | 'microvm_attached'
        | 'step_redriven'
        | 'machine_starting'
        | 'machine_running'
        | 'machine_pausing'
        | 'machine_paused'
        | 'machine_resuming'
        | 'machine_hibernating'
        | 'machine_hibernated'
        | 'machine_restarting'
        | 'machine_upgrading'
        | 'machine_terminating'
        | 'machine_terminated'
        | 'machine_failed'
        | 'rootfs_selected'
        | 'rootfs_ready'
        | 'rootfs_failed'
        | 'rootfs_activated'
        | 'rootfs_cancelled'
        | 'rootfs_deleted'
        | 'machine_created'
        | 'machine_updated'
        | 'machine_policy_updated'
        | 'machine_operation_superseded'
        | 'instance_created'
        | 'instance_expiring'
        | 'machine_disk_attached'
        | 'machine_disk_detached'
        | 'disk_wait_started'
        | 'disk_wait_ended'
        | 'recovery_scheduled'
        | 'runtime_setup_started'
        | 'runtime_setup_succeeded'
        | 'runtime_setup_failed'
        | 'runtime_entrypoint_started'
        | 'runtime_entrypoint_exited'
        | 'runtime_failed'
      )[]
    | undefined;
  source?:
    | 'agent'
    | 'api'
    | 'policy'
    | 'guest'
    | 'system'
    | ('agent' | 'api' | 'policy' | 'guest' | 'system')[]
    | undefined;
  reverse?: boolean | undefined;
};

export let mapSandboxMachinesEventsListQuery =
  /* @__PURE__ */ createMapper<SandboxMachinesEventsListQuery>([
    3,
    [[0, [1, ['machine_instance_id']]]]
  ]);
