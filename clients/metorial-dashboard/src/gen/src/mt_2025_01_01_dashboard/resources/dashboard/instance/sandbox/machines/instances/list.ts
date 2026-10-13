import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSandboxMachinesInstancesListOutput = {
  items: {
    object: 'sandbox.machine.instance';
    id: string;
    machineId: string;
    generation: number;
    status: string;
    phase:
      | 'starting'
      | 'running'
      | 'pausing'
      | 'paused'
      | 'resuming'
      | 'terminating'
      | 'terminated'
      | 'failed';
    creationReason: string | null;
    image: { id: string | null; versionId: string | null };
    spec: { id: string | null; memoryMib: number; vcpus: number };
    operation: { id: string; kind: string; requestedAt: Date } | null;
    mounts: {
      diskId: string;
      mountPath: string;
      status:
        | 'failed'
        | 'pending'
        | 'mounted'
        | 'recovering'
        | 'skipped'
        | 'released';
    }[];
    disksReady: boolean;
    runtime: {
      state: string;
      setup: { id: string; exitCode: number; durationMs: number }[];
      entrypoint: {
        startedAfterMs: number | null;
        exitCode: number | null;
        signal: string | null;
      } | null;
      error: { code: string; message: string } | null;
    } | null;
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
    hasLogs: boolean;
    createdAt: Date;
    startedAt: Date | null;
    readyAt: Date | null;
    pausedAt: Date | null;
    terminatedAt: Date | null;
    lastSeenAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxMachinesInstancesListOutput =
  mtMap.object<DashboardInstanceSandboxMachinesInstancesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          machineId: mtMap.objectField('machine_id', mtMap.passthrough()),
          generation: mtMap.objectField('generation', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          phase: mtMap.objectField('phase', mtMap.passthrough()),
          creationReason: mtMap.objectField(
            'creation_reason',
            mtMap.passthrough()
          ),
          image: mtMap.objectField(
            'image',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              versionId: mtMap.objectField('version_id', mtMap.passthrough())
            })
          ),
          spec: mtMap.objectField(
            'spec',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              memoryMib: mtMap.objectField('memory_mib', mtMap.passthrough()),
              vcpus: mtMap.objectField('vcpus', mtMap.passthrough())
            })
          ),
          operation: mtMap.objectField(
            'operation',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              kind: mtMap.objectField('kind', mtMap.passthrough()),
              requestedAt: mtMap.objectField('requested_at', mtMap.date())
            })
          ),
          mounts: mtMap.objectField(
            'mounts',
            mtMap.array(
              mtMap.object({
                diskId: mtMap.objectField('disk_id', mtMap.passthrough()),
                mountPath: mtMap.objectField('mount_path', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough())
              })
            )
          ),
          disksReady: mtMap.objectField('disks_ready', mtMap.passthrough()),
          runtime: mtMap.objectField(
            'runtime',
            mtMap.object({
              state: mtMap.objectField('state', mtMap.passthrough()),
              setup: mtMap.objectField(
                'setup',
                mtMap.array(
                  mtMap.object({
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    exitCode: mtMap.objectField(
                      'exit_code',
                      mtMap.passthrough()
                    ),
                    durationMs: mtMap.objectField(
                      'duration_ms',
                      mtMap.passthrough()
                    )
                  })
                )
              ),
              entrypoint: mtMap.objectField(
                'entrypoint',
                mtMap.object({
                  startedAfterMs: mtMap.objectField(
                    'started_after_ms',
                    mtMap.passthrough()
                  ),
                  exitCode: mtMap.objectField('exit_code', mtMap.passthrough()),
                  signal: mtMap.objectField('signal', mtMap.passthrough())
                })
              ),
              error: mtMap.objectField(
                'error',
                mtMap.object({
                  code: mtMap.objectField('code', mtMap.passthrough()),
                  message: mtMap.objectField('message', mtMap.passthrough())
                })
              )
            })
          ),
          failure: mtMap.objectField(
            'failure',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          hasLogs: mtMap.objectField('has_logs', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          startedAt: mtMap.objectField('started_at', mtMap.date()),
          readyAt: mtMap.objectField('ready_at', mtMap.date()),
          pausedAt: mtMap.objectField('paused_at', mtMap.date()),
          terminatedAt: mtMap.objectField('terminated_at', mtMap.date()),
          lastSeenAt: mtMap.objectField('last_seen_at', mtMap.date())
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

export type DashboardInstanceSandboxMachinesInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'start_requested'
    | 'start_platform_pending'
    | 'start_platform_complete'
    | 'start_initialize_pending'
    | 'running'
    | 'pause_requested'
    | 'pause_prepare_pending'
    | 'pause_prepare_complete'
    | 'pause_platform_pending'
    | 'paused'
    | 'resume_requested'
    | 'resume_platform_pending'
    | 'resume_platform_complete'
    | 'resume_initialize_pending'
    | 'terminate_requested'
    | 'terminate_prepare_pending'
    | 'terminate_prepare_complete'
    | 'terminate_platform_pending'
    | 'terminated'
    | 'failed'
    | (
        | 'start_requested'
        | 'start_platform_pending'
        | 'start_platform_complete'
        | 'start_initialize_pending'
        | 'running'
        | 'pause_requested'
        | 'pause_prepare_pending'
        | 'pause_prepare_complete'
        | 'pause_platform_pending'
        | 'paused'
        | 'resume_requested'
        | 'resume_platform_pending'
        | 'resume_platform_complete'
        | 'resume_initialize_pending'
        | 'terminate_requested'
        | 'terminate_prepare_pending'
        | 'terminate_prepare_complete'
        | 'terminate_platform_pending'
        | 'terminated'
        | 'failed'
      )[]
    | undefined;
};

export let mapDashboardInstanceSandboxMachinesInstancesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

