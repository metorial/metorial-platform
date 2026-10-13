import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxMachinesStartOutput = {
  object: 'sandbox.machine';
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
  slug: string;
  region: string;
  image: { id: string | null; versionId: string | null };
  spec: { id: string | null; memoryMib: number; vcpus: number };
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
    kind: 'start' | 'pause' | 'hibernate' | 'restart' | 'terminate';
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

export let mapSandboxMachinesStartOutput =
  mtMap.object<SandboxMachinesStartOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    region: mtMap.objectField('region', mtMap.passthrough()),
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
    rootDisk: mtMap.objectField(
      'root_disk',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        sizeBytes: mtMap.objectField('size_bytes', mtMap.passthrough())
      })
    ),
    mounts: mtMap.objectField(
      'mounts',
      mtMap.array(
        mtMap.object({
          diskId: mtMap.objectField('disk_id', mtMap.passthrough()),
          mountPath: mtMap.objectField('mount_path', mtMap.passthrough()),
          state: mtMap.objectField('state', mtMap.passthrough())
        })
      )
    ),
    firewallIds: mtMap.objectField(
      'firewall_ids',
      mtMap.array(mtMap.passthrough())
    ),
    publicPorts: mtMap.objectField(
      'public_ports',
      mtMap.array(mtMap.passthrough())
    ),
    lifecyclePolicy: mtMap.objectField(
      'lifecycle_policy',
      mtMap.object({
        pauseAfterIdleSeconds: mtMap.objectField(
          'pause_after_idle_seconds',
          mtMap.passthrough()
        ),
        hibernateAfterPausedSeconds: mtMap.objectField(
          'hibernate_after_paused_seconds',
          mtMap.passthrough()
        ),
        connectionIdleSeconds: mtMap.objectField(
          'connection_idle_seconds',
          mtMap.passthrough()
        )
      })
    ),
    runtime: mtMap.objectField(
      'runtime',
      mtMap.object({
        setup: mtMap.objectField('setup', mtMap.array(mtMap.passthrough())),
        entrypoint: mtMap.objectField(
          'entrypoint',
          mtMap.array(mtMap.passthrough())
        ),
        cmd: mtMap.objectField('cmd', mtMap.array(mtMap.passthrough())),
        env: mtMap.objectField('env', mtMap.passthrough()),
        workdir: mtMap.objectField('workdir', mtMap.passthrough()),
        user: mtMap.objectField('user', mtMap.passthrough()),
        stopSignal: mtMap.objectField('stop_signal', mtMap.passthrough())
      })
    ),
    lifecycleHooks: mtMap.objectField(
      'lifecycle_hooks',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          on: mtMap.objectField('on', mtMap.passthrough()),
          port: mtMap.objectField('port', mtMap.passthrough()),
          path: mtMap.objectField('path', mtMap.passthrough()),
          arguments: mtMap.objectField(
            'arguments',
            mtMap.array(mtMap.passthrough())
          ),
          wait: mtMap.objectField('wait', mtMap.passthrough()),
          timeoutSeconds: mtMap.objectField(
            'timeout_seconds',
            mtMap.passthrough()
          )
        })
      )
    ),
    ignoreImageHooks: mtMap.objectField(
      'ignore_image_hooks',
      mtMap.passthrough()
    ),
    entrypointWaitSeconds: mtMap.objectField(
      'entrypoint_wait_seconds',
      mtMap.passthrough()
    ),
    operation: mtMap.objectField(
      'operation',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        kind: mtMap.objectField('kind', mtMap.passthrough()),
        trigger: mtMap.objectField('trigger', mtMap.passthrough()),
        requestedAt: mtMap.objectField('requested_at', mtMap.date())
      })
    ),
    currentInstance: mtMap.objectField(
      'current_instance',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        generation: mtMap.objectField('generation', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        phase: mtMap.objectField('phase', mtMap.passthrough())
      })
    ),
    lastActivityAt: mtMap.objectField('last_activity_at', mtMap.date()),
    pauseAt: mtMap.objectField('pause_at', mtMap.date()),
    hibernatesAt: mtMap.objectField('hibernates_at', mtMap.date()),
    upcomingEvents: mtMap.objectField(
      'upcoming_events',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          occursAt: mtMap.objectField('occurs_at', mtMap.date())
        })
      )
    ),
    failure: mtMap.objectField(
      'failure',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    runningAt: mtMap.objectField('running_at', mtMap.date()),
    pausedAt: mtMap.objectField('paused_at', mtMap.date()),
    hibernatedAt: mtMap.objectField('hibernated_at', mtMap.date()),
    terminatedAt: mtMap.objectField('terminated_at', mtMap.date())
  });

