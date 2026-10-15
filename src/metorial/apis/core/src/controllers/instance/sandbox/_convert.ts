import { v } from '@lowerdeck/validation';

let stopSignals = [
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGILL',
  'SIGTRAP',
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGKILL',
  'SIGUSR1',
  'SIGSEGV',
  'SIGUSR2',
  'SIGPIPE',
  'SIGALRM',
  'SIGTERM',
  'SIGSTKFLT',
  'SIGCHLD',
  'SIGCONT',
  'SIGSTOP',
  'SIGTSTP',
  'SIGTTIN',
  'SIGTTOU',
  'SIGURG',
  'SIGXCPU',
  'SIGXFSZ',
  'SIGVTALRM',
  'SIGPROF',
  'SIGWINCH',
  'SIGIO',
  'SIGPWR',
  'SIGSYS'
] as const;

let hookTriggers = ['start', 'pause', 'resume', 'terminate'] as const;

export let lifecyclePolicyValidator = v.object({
  pause_after_idle_seconds: v.optional(
    v.nullable(v.number({ description: 'Pause the machine after this many idle seconds' }))
  ),
  hibernate_after_paused_seconds: v.optional(
    v.nullable(
      v.number({
        description: 'Hibernate the machine after it was paused for this many seconds'
      })
    )
  ),
  connection_idle_seconds: v.optional(
    v.nullable(v.number({ description: 'Consider a connection idle after this many seconds' }))
  )
});

export let runtimeValidator = v.object({
  setup: v.optional(
    v.array(v.string(), { description: 'Commands run once before the entrypoint starts' })
  ),
  entrypoint: v.optional(v.array(v.string(), { description: 'The entrypoint command' })),
  cmd: v.optional(
    v.array(v.string(), { description: 'Default arguments for the entrypoint' })
  ),
  env: v.optional(v.record(v.string(), { description: 'Environment variables' })),
  workdir: v.optional(v.string({ description: 'The working directory' })),
  user: v.optional(v.string({ description: 'The user the entrypoint runs as' })),
  stop_signal: v.optional(
    v.enumOf([...stopSignals], {
      description: 'The signal sent to the entrypoint when the machine stops'
    })
  )
});

export let lifecycleHookValidator = v.union([
  v.object({
    type: v.literal('http'),
    on: v.enumOf([...hookTriggers]),
    port: v.number(),
    path: v.string(),
    wait: v.optional(v.boolean()),
    timeout_seconds: v.optional(v.number())
  }),
  v.object({
    type: v.literal('script'),
    on: v.enumOf([...hookTriggers]),
    path: v.string(),
    arguments: v.array(v.string()),
    wait: v.optional(v.boolean()),
    timeout_seconds: v.optional(v.number())
  })
]);

export let mountValidator = v.object({
  disk_id: v.string({ description: 'The disk to mount' }),
  mount_path: v.string({ description: 'Where to mount the disk inside the machine' })
});

export let toLifecyclePolicyInput = (
  policy:
    | {
        pause_after_idle_seconds?: number | null;
        hibernate_after_paused_seconds?: number | null;
        connection_idle_seconds?: number | null;
      }
    | undefined
) =>
  policy
    ? {
        pauseAfterIdleSeconds: policy.pause_after_idle_seconds,
        hibernateAfterPausedSeconds: policy.hibernate_after_paused_seconds,
        connectionIdleSeconds: policy.connection_idle_seconds
      }
    : undefined;

export let toRuntimeInput = (
  runtime:
    | {
        setup?: string[];
        entrypoint?: string[];
        cmd?: string[];
        env?: Record<string, string>;
        workdir?: string;
        user?: string;
        stop_signal?: (typeof stopSignals)[number];
      }
    | null
    | undefined
) =>
  runtime
    ? {
        setup: runtime.setup,
        entrypoint: runtime.entrypoint,
        cmd: runtime.cmd,
        env: runtime.env,
        workdir: runtime.workdir,
        user: runtime.user,
        stopSignal: runtime.stop_signal
      }
    : runtime;

export let toLifecycleHooksInput = (
  hooks:
    | (
        | {
            type: 'http';
            on: (typeof hookTriggers)[number];
            port: number;
            path: string;
            wait?: boolean;
            timeout_seconds?: number;
          }
        | {
            type: 'script';
            on: (typeof hookTriggers)[number];
            path: string;
            arguments: string[];
            wait?: boolean;
            timeout_seconds?: number;
          }
      )[]
    | null
    | undefined
) =>
  hooks?.map(({ timeout_seconds, ...hook }) => ({
    ...hook,
    timeoutSeconds: timeout_seconds
  })) ?? hooks;

export let toMountsInput = (mounts: { disk_id: string; mount_path: string }[] | undefined) =>
  mounts?.map(mount => ({ diskId: mount.disk_id, mountPath: mount.mount_path }));
