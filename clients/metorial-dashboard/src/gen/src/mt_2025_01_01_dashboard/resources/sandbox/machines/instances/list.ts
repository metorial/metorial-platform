import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesInstancesListOutput = {
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
    spec: {
      id: string | null;
      identifier: string;
      memoryGib: number;
      cpus: number;
    };
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

export let mapSandboxMachinesInstancesListOutput =
  /* @__PURE__ */ createMapper<SandboxMachinesInstancesListOutput>(
    [
      7,
      [
        1,
        [
          'machine_id',
          'creation_reason',
          ['image', 0, [1, ['version_id']]],
          ['spec', 0, [1, ['memory_gib']]],
          ['operation', 0, [1, ['requested_at']]],
          ['mounts', 0, [2, [1, ['disk_id', 'mount_path']]]],
          'disks_ready',
          [
            'runtime',
            0,
            [
              1,
              [
                ['setup', 0, [2, [1, ['exit_code', 'duration_ms']]]],
                ['entrypoint', 0, [1, ['started_after_ms', 'exit_code']]]
              ]
            ]
          ],
          'has_logs',
          'created_at',
          'started_at',
          'ready_at',
          'paused_at',
          'terminated_at',
          'last_seen_at'
        ]
      ]
    ],
    1
  );

export type SandboxMachinesInstancesListQuery = {
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

export let mapSandboxMachinesInstancesListQuery =
  /* @__PURE__ */ createMapper<SandboxMachinesInstancesListQuery>(0);
