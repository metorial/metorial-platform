import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesInstancesGetOutput = {
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
};

export let mapDashboardInstanceSandboxMachinesInstancesGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesInstancesGetOutput>(
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
    ],
    1
  );
