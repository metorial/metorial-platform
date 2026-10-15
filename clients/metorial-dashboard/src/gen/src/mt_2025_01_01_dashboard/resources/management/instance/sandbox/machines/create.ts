import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesCreateOutput = {
  object: 'sandbox.machine';
  metadata: Record<string, any>;
  id: string;
  status:
    | 'starting'
    | 'running'
    | 'pausing'
    | 'paused'
    | 'resuming'
    | 'hibernating'
    | 'hibernated'
    | 'restarting'
    | 'upgrading'
    | 'terminating'
    | 'terminated'
    | 'failed';
  name: string | null;
  slug: string | null;
  region: string;
  image: {
    id: string | null;
    name: string | null;
    identifier: string | null;
    versionId: string | null;
  };
  spec: {
    id: string | null;
    identifier: string;
    memoryGib: number;
    cpus: number;
  } | null;
  maxBoost: { memoryGib: number; cpus: number } | null;
  rootDisk: { id: string; sizeBytes: number | null } | null;
  mounts: {
    diskId: string;
    mountPath: string;
    state:
      | 'failed'
      | 'waiting'
      | 'detaching'
      | 'idle'
      | 'pending'
      | 'mounted'
      | 'recovering'
      | 'skipped'
      | 'released';
  }[];
  firewallIds: string[];
  publicPorts: number[];
  lifecyclePolicy: {
    pauseAfterIdleSeconds: number | null;
    hibernateAfterPausedSeconds: number | null;
    connectionIdleSeconds: number | null;
  };
  runtime: {
    setup: string[] | null;
    entrypoint: string[] | null;
    cmd: string[] | null;
    env: Record<string, string> | null;
    workdir: string | null;
    user: string | null;
    stopSignal: string | null;
  } | null;
  lifecycleHooks: {
    type: 'http' | 'script';
    on: 'start' | 'pause' | 'resume' | 'terminate';
    port: number | null;
    path: string;
    arguments: string[] | null;
    wait: boolean | null;
    timeoutSeconds: number | null;
  }[];
  ignoreImageHooks: boolean;
  entrypointWaitSeconds: number | null;
  operation: {
    id: string;
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
    requestedAt: Date;
  } | null;
  currentInstance: {
    id: string;
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
  } | null;
  restartRequired: boolean;
  lastActivityAt: Date | null;
  pauseAt: Date | null;
  hibernatesAt: Date | null;
  upcomingEvents: {
    type: 'pause' | 'hibernate' | 'reprovision' | 'restart';
    occursAt: Date;
  }[];
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
  createdAt: Date;
  runningAt: Date | null;
  pausedAt: Date | null;
  hibernatedAt: Date | null;
  terminatedAt: Date | null;
};

export let mapManagementInstanceSandboxMachinesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesCreateOutput>(
    [
      ['image', 0, [1, ['version_id']]],
      ['spec', 0, [1, ['memory_gib']]],
      ['max_boost', 1, [1, ['memory_gib']]],
      ['root_disk', 1, [1, ['size_bytes']]],
      ['mounts', 0, [2, [1, ['disk_id', 'mount_path']]]],
      'firewall_ids',
      'public_ports',
      [
        'lifecycle_policy',
        1,
        [
          1,
          [
            'pause_after_idle_seconds',
            'hibernate_after_paused_seconds',
            'connection_idle_seconds'
          ]
        ]
      ],
      ['runtime', 0, [1, ['stop_signal']]],
      ['lifecycle_hooks', 1, [2, [1, ['timeout_seconds']]]],
      'ignore_image_hooks',
      'entrypoint_wait_seconds',
      ['operation', 0, [1, ['requested_at']]],
      'current_instance',
      'restart_required',
      'last_activity_at',
      'pause_at',
      'hibernates_at',
      ['upcoming_events', 1, [2, [1, ['occurs_at']]]],
      'created_at',
      'running_at',
      'paused_at',
      'hibernated_at',
      'terminated_at'
    ],
    1
  );

export type ManagementInstanceSandboxMachinesCreateBody = {
  region: string;
  metadata?: Record<string, any> | undefined;
  name?: string | undefined;
  imageId: string;
  specId?: string | undefined;
  specIdentifier?: string | undefined;
  memoryGib?: number | undefined;
  cpus?: number | undefined;
  lifecyclePolicy?:
    | {
        pauseAfterIdleSeconds?: number | null | undefined;
        hibernateAfterPausedSeconds?: number | null | undefined;
        connectionIdleSeconds?: number | null | undefined;
      }
    | undefined;
  runtime?:
    | {
        setup?: string[] | undefined;
        entrypoint?: string[] | undefined;
        cmd?: string[] | undefined;
        env?: Record<string, string> | undefined;
        workdir?: string | undefined;
        user?: string | undefined;
        stopSignal?:
          | 'SIGHUP'
          | 'SIGINT'
          | 'SIGQUIT'
          | 'SIGILL'
          | 'SIGTRAP'
          | 'SIGABRT'
          | 'SIGBUS'
          | 'SIGFPE'
          | 'SIGKILL'
          | 'SIGUSR1'
          | 'SIGSEGV'
          | 'SIGUSR2'
          | 'SIGPIPE'
          | 'SIGALRM'
          | 'SIGTERM'
          | 'SIGSTKFLT'
          | 'SIGCHLD'
          | 'SIGCONT'
          | 'SIGSTOP'
          | 'SIGTSTP'
          | 'SIGTTIN'
          | 'SIGTTOU'
          | 'SIGURG'
          | 'SIGXCPU'
          | 'SIGXFSZ'
          | 'SIGVTALRM'
          | 'SIGPROF'
          | 'SIGWINCH'
          | 'SIGIO'
          | 'SIGPWR'
          | 'SIGSYS'
          | undefined;
      }
    | null
    | undefined;
  lifecycleHooks?:
    | (
        | {
            type: 'http';
            on: 'start' | 'pause' | 'resume' | 'terminate';
            port: number;
            path: string;
            wait?: boolean | undefined;
            timeoutSeconds?: number | undefined;
          }
        | {
            type: 'script';
            on: 'start' | 'pause' | 'resume' | 'terminate';
            path: string;
            arguments: string[];
            wait?: boolean | undefined;
            timeoutSeconds?: number | undefined;
          }
      )[]
    | null
    | undefined;
  ignoreImageHooks?: boolean | undefined;
  entrypointWaitSeconds?: number | null | undefined;
  mounts?: { diskId: string; mountPath: string }[] | undefined;
  firewallIds?: string[] | undefined;
  publicPorts?: number[] | undefined;
  start?: boolean | undefined;
};

export let mapManagementInstanceSandboxMachinesCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesCreateBody>([
    'image_id',
    'spec_id',
    'spec_identifier',
    'memory_gib',
    [
      'lifecycle_policy',
      1,
      [
        1,
        [
          'pause_after_idle_seconds',
          'hibernate_after_paused_seconds',
          'connection_idle_seconds'
        ]
      ]
    ],
    ['runtime', 0, [1, ['stop_signal']]],
    ['lifecycle_hooks', 1, [2, [3, [[0, [1, ['timeout_seconds']]]]]]],
    'ignore_image_hooks',
    'entrypoint_wait_seconds',
    ['mounts', 0, [2, [1, ['disk_id', 'mount_path']]]],
    'firewall_ids',
    'public_ports'
  ]);
