import { v } from '@lowerdeck/validation';
import {
  mapSandboxFailure,
  resolveSandboxImageRef,
  resolveSandboxSpecId
} from '@metorial/module-sandbox';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineType } from '../../types';
import {
  sandboxFailureSchema,
  sandboxReferenceSchema,
  toNullableNumber,
  toRawFailure
} from './_shared';

let UPCOMING_EVENT_WINDOW_MS = 60 * 60 * 1000;

let machineStatuses = [
  'starting',
  'running',
  'pausing',
  'paused',
  'resuming',
  'hibernating',
  'hibernated',
  'restarting',
  'upgrading',
  'terminating',
  'terminated',
  'failed'
] as const;

let mountStates = [
  'failed',
  'waiting',
  'detaching',
  'idle',
  'pending',
  'mounted',
  'recovering',
  'skipped',
  'released'
] as const;

export let sandboxMachineOperationKinds = [
  'start',
  'pause',
  'hibernate',
  'restart',
  'terminate',
  'update',
  'upgrade'
] as const;

let operationTriggers = [
  'api',
  'access',
  'idle_policy',
  'paused_policy',
  'lifetime',
  'failure',
  'platform',
  'update'
] as const;

let instancePhases = [
  'starting',
  'running',
  'pausing',
  'paused',
  'resuming',
  'terminating',
  'terminated',
  'failed'
] as const;

let runtimeSchema = v.object({
  setup: v.nullable(
    v.array(v.string(), { description: 'Commands run once before the entrypoint starts' })
  ),
  entrypoint: v.nullable(v.array(v.string(), { description: 'The entrypoint command' })),
  cmd: v.nullable(
    v.array(v.string(), { description: 'Default arguments for the entrypoint' })
  ),
  env: v.nullable(v.record(v.string(), { description: 'Environment variables' })),
  workdir: v.nullable(v.string({ description: 'The working directory' })),
  user: v.nullable(v.string({ description: 'The user the entrypoint runs as' })),
  stop_signal: v.nullable(
    v.string({ description: 'The signal sent to the entrypoint when the machine stops' })
  )
});

let lifecycleHookSchema = v.object({
  type: v.enumOf(['http', 'script'], { description: 'How the hook is invoked' }),
  on: v.enumOf(['start', 'pause', 'resume', 'terminate'], {
    description: 'The lifecycle transition the hook runs on'
  }),
  port: v.nullable(v.number({ description: 'The port requested by an http hook' })),
  path: v.string({ description: 'The URL path of an http hook or the file of a script hook' }),
  arguments: v.nullable(
    v.array(v.string(), { description: 'The arguments passed to a script hook' })
  ),
  wait: v.nullable(
    v.boolean({ description: 'Whether the transition waits for the hook to finish' })
  ),
  timeout_seconds: v.nullable(
    v.number({ description: 'How long the hook may run before it is considered failed' })
  )
});

type RemoteRuntime = {
  setup?: string[];
  entrypoint?: string[];
  cmd?: string[];
  env?: Record<string, string>;
  workdir?: string;
  user?: string;
  stopSignal?: string;
};

type RemoteHook = {
  type: 'http' | 'script';
  on: 'start' | 'pause' | 'resume' | 'terminate';
  port?: number;
  path: string;
  arguments?: string[];
  wait?: boolean;
  timeoutSeconds?: number;
};

export let presentSandboxRuntime = (runtime: unknown) => {
  let value = runtime as RemoteRuntime | null;
  if (!value) return null;

  return {
    setup: value.setup ?? null,
    entrypoint: value.entrypoint ?? null,
    cmd: value.cmd ?? null,
    env: value.env ?? null,
    workdir: value.workdir ?? null,
    user: value.user ?? null,
    stop_signal: value.stopSignal ?? null
  };
};

export let presentSandboxLifecycleHook = (hook: unknown) => {
  let value = hook as RemoteHook;

  return {
    type: value.type,
    on: value.on,
    port: value.port ?? null,
    path: value.path,
    arguments: value.arguments ?? null,
    wait: value.wait ?? null,
    timeout_seconds: value.timeoutSeconds ?? null
  };
};

export let getSandboxUpcomingEvents = (
  schedule: {
    pauseAt: Date | null;
    hibernateAt: Date | null;
    restartAt: Date | null;
    instanceExpiresAt: Date | null;
  },
  now = new Date()
) =>
  [
    { type: 'pause' as const, occurs_at: schedule.pauseAt },
    { type: 'hibernate' as const, occurs_at: schedule.hibernateAt },
    { type: 'restart' as const, occurs_at: schedule.restartAt },
    { type: 'reprovision' as const, occurs_at: schedule.instanceExpiresAt }
  ]
    .filter(
      (event): event is { type: typeof event.type; occurs_at: Date } =>
        !!event.occurs_at &&
        event.occurs_at.getTime() <= now.getTime() + UPCOMING_EVENT_WINDOW_MS
    )
    .sort((a, b) => a.occurs_at.getTime() - b.occurs_at.getTime());

export let v1SandboxMachinePresenter = Presenter.create(sandboxMachineType)
  .presenter(async ({ machine }) => {
    let remote = machine.remote;
    let regionOid = machine.tenant.region.oid;

    let [image, specId] = remote
      ? await Promise.all([
          resolveSandboxImageRef({
            regionOid,
            genesisImageId: remote.image.imageId,
            genesisVersionId: remote.image.versionId
          }),
          resolveSandboxSpecId({ regionOid, genesisSpecId: remote.spec.id })
        ])
      : [null, null];

    let rootFs = remote ? (remote.rootFs.current ?? remote.rootFs.desired) : null;

    return {
      object: 'sandbox.machine' as const,

      id: machine.id,
      metadata: machine.metadata ?? {},
      status: remote?.status ?? ('terminated' as const),
      name: remote?.name ?? null,
      slug: remote?.slug ?? null,
      region: machine.tenant.region.identifier,

      image: {
        id: image ? image.imageId : (machine.image?.id ?? null),
        name: machine.image?.name ?? null,
        identifier: machine.image?.identifier ?? null,
        version_id: image?.versionId ?? null
      },
      spec: remote
        ? {
            id: specId,
            identifier: remote.spec.identifier,
            memory_gib: remote.spec.memoryMiB / 1024,
            cpus: remote.spec.vcpus
          }
        : null,
      root_disk: rootFs
        ? { id: rootFs.diskId, size_bytes: toNullableNumber(rootFs.diskSizeBytes) }
        : null,
      mounts: (remote?.disks ?? [])
        .filter(disk => disk.purpose != 'root_fs')
        .map(disk => ({
          disk_id: disk.diskId,
          mount_path: disk.mountPath,
          state: disk.state
        })),
      firewall_ids: machine.firewallLinks.map(link => link.firewall.id),
      public_ports: remote?.publicPorts ?? [],

      lifecycle_policy: {
        pause_after_idle_seconds: remote?.lifecyclePolicy.pauseAfterIdleSeconds ?? null,
        hibernate_after_paused_seconds:
          remote?.lifecyclePolicy.hibernateAfterPausedSeconds ?? null,
        connection_idle_seconds: remote?.lifecyclePolicy.connectionIdleSeconds ?? null
      },
      runtime: remote ? presentSandboxRuntime(remote.runtime) : null,
      lifecycle_hooks: (remote?.lifecycleHooks ?? []).map(presentSandboxLifecycleHook),
      ignore_image_hooks: remote?.ignoreImageHooks ?? false,
      entrypoint_wait_seconds: remote?.entrypointWaitSeconds ?? null,

      operation: remote?.operation
        ? {
            id: remote.operation.id,
            kind: remote.operation.kind,
            trigger: remote.operation.trigger,
            requested_at: remote.operation.requestedAt
          }
        : null,
      current_instance: remote?.currentInstance
        ? {
            id: remote.currentInstance.id,
            generation: remote.currentInstance.generation,
            status: remote.currentInstance.status as string,
            phase: remote.currentInstance.phase
          }
        : null,
      restart_required: remote?.currentInstance?.stale ?? false,

      last_activity_at: remote?.schedule.lastActivityAt ?? null,
      pause_at: remote?.schedule.pauseAt ?? null,
      hibernates_at: remote?.schedule.hibernateAt ?? null,
      upcoming_events: remote ? getSandboxUpcomingEvents(remote.schedule) : [],

      failure: remote ? mapSandboxFailure(toRawFailure(remote.failure)) : null,

      created_at: remote?.createdAt ?? machine.createdAt,
      running_at: remote?.runningAt ?? null,
      paused_at: remote?.pausedAt ?? null,
      hibernated_at: remote?.hibernatedAt ?? null,
      terminated_at: remote ? remote.terminatedAt : machine.deletedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('sandbox.machine', {
        description: "String representing the object's type"
      }),

      metadata: v.record(v.any(), { description: 'User-defined metadata stored in Metorial' }),
      id: v.string({ description: "The machine's unique identifier" }),
      status: v.enumOf([...machineStatuses], { description: "The machine's current status" }),
      name: v.nullable(v.string({ description: "The machine's name" })),
      slug: v.nullable(
        v.string({
          description:
            "The machine's URL-safe slug, used in access hostnames. Null once a terminated machine's details expired."
        })
      ),
      region: v.string({ description: 'The identifier of the region the machine runs in' }),

      image: v.object({
        id: sandboxReferenceSchema('The image the machine boots from'),
        name: v.nullable(v.string({ description: 'The image name' })),
        identifier: v.nullable(v.string({ description: 'The global image identifier' })),
        version_id: sandboxReferenceSchema('The image version the machine boots from')
      }),
      spec: v.nullable(
        v.object(
          {
            id: sandboxReferenceSchema('The spec the machine was created with'),
            identifier: v.string({
              description: "The spec's human-readable identifier",
              examples: ['m3072-c3000']
            }),
            memory_gib: v.number({ description: "The machine's memory in GiB" }),
            cpus: v.number({ description: "The machine's CPU count" })
          },
          {
            description:
              "The machine's size. Null once a terminated machine's details expired, about 30 days after termination."
          }
        )
      ),
      root_disk: v.nullable(
        v.object(
          {
            id: v.string({ description: "The root disk's identifier" }),
            size_bytes: v.nullable(v.number({ description: "The root disk's size in bytes" }))
          },
          { description: "The machine's root filesystem disk" }
        )
      ),
      mounts: v.array(
        v.object({
          disk_id: v.string({ description: 'The mounted disk' }),
          mount_path: v.string({ description: 'Where the disk is mounted in the machine' }),
          state: v.enumOf([...mountStates], {
            description: 'Whether the disk is currently mounted'
          })
        }),
        { description: 'The additional disks mounted into the machine' }
      ),
      firewall_ids: v.array(v.string(), {
        description: 'The firewalls applied to the machine'
      }),
      public_ports: v.array(v.number(), {
        description: 'The ports reachable without an access token'
      }),

      lifecycle_policy: v.object({
        pause_after_idle_seconds: v.nullable(
          v.number({ description: 'Pause the machine after this many idle seconds' })
        ),
        hibernate_after_paused_seconds: v.nullable(
          v.number({
            description: 'Hibernate the machine after it was paused for this many seconds'
          })
        ),
        connection_idle_seconds: v.nullable(
          v.number({ description: 'Consider a connection idle after this many seconds' })
        )
      }),
      runtime: v.nullable(runtimeSchema),
      lifecycle_hooks: v.array(lifecycleHookSchema, {
        description: 'Hooks that run on lifecycle transitions'
      }),
      ignore_image_hooks: v.boolean({
        description: "Whether the image's own lifecycle hooks are ignored"
      }),
      entrypoint_wait_seconds: v.nullable(
        v.number({ description: 'How long startup waits for the entrypoint' })
      ),

      operation: v.nullable(
        v.object(
          {
            id: v.string(),
            kind: v.enumOf([...sandboxMachineOperationKinds]),
            trigger: v.enumOf([...operationTriggers]),
            requested_at: v.date()
          },
          { description: 'The operation currently in flight, if any' }
        )
      ),
      current_instance: v.nullable(
        v.object(
          {
            id: v.string(),
            generation: v.number(),
            status: v.string(),
            phase: v.enumOf([...instancePhases])
          },
          { description: 'The instance currently backing the machine, if any' }
        )
      ),
      restart_required: v.boolean({
        description:
          'Whether the running instance still uses an older configuration than the machine was last updated to. Metorial replaces such an instance on its own, restarting a running machine and hibernating a paused one, and the update is live once the machine starts again.'
      }),

      last_activity_at: v.nullable(
        v.date({ description: 'When the machine was last active' })
      ),
      pause_at: v.nullable(v.date({ description: 'When the machine will be paused next' })),
      hibernates_at: v.nullable(
        v.date({ description: 'When the machine will be hibernated next' })
      ),
      upcoming_events: v.array(
        v.object({
          type: v.enumOf(['pause', 'hibernate', 'reprovision', 'restart'], {
            description: 'What will happen'
          }),
          occurs_at: v.date({ description: 'When it will happen' })
        }),
        {
          description:
            'Scheduled events within the next hour, soonest first. Reprovision replaces the underlying instance.'
        }
      ),

      failure: v.nullable(sandboxFailureSchema),

      created_at: v.date({ description: "The machine's creation date" }),
      running_at: v.nullable(v.date({ description: 'When the machine last started running' })),
      paused_at: v.nullable(v.date({ description: 'When the machine was last paused' })),
      hibernated_at: v.nullable(
        v.date({ description: 'When the machine was last hibernated' })
      ),
      terminated_at: v.nullable(v.date({ description: 'When the machine was terminated' }))
    })
  )
  .build();
