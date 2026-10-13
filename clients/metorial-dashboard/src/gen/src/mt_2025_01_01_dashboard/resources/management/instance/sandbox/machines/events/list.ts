import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSandboxMachinesEventsListOutput = {
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

export let mapManagementInstanceSandboxMachinesEventsListOutput =
  mtMap.object<ManagementInstanceSandboxMachinesEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
          guestErrorId: mtMap.objectField(
            'guest_error_id',
            mtMap.passthrough()
          ),
          error: mtMap.objectField(
            'error',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          occurredAt: mtMap.objectField('occurred_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ManagementInstanceSandboxMachinesEventsListQuery = {
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

export let mapManagementInstanceSandboxMachinesEventsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      scope: mtMap.objectField('scope', mtMap.passthrough()),
      machineInstanceId: mtMap.objectField(
        'machine_instance_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      type: mtMap.objectField(
        'type',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      source: mtMap.objectField(
        'source',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      reverse: mtMap.objectField('reverse', mtMap.passthrough())
    })
  )
]);

