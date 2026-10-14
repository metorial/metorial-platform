import { v } from '@lowerdeck/validation';
import {
  mapSandboxFailure,
  resolveSandboxImageRef,
  resolveSandboxSpecId
} from '@metorial/module-sandbox';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineInstanceType } from '../../types';
import { sandboxFailureSchema, sandboxReferenceSchema, toRawFailure } from './_shared';

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

export let v1SandboxMachineInstancePresenter = Presenter.create(sandboxMachineInstanceType)
  .presenter(async ({ machine, instance }) => {
    let regionOid = machine.tenant.region.oid;

    let [image, specId] = await Promise.all([
      resolveSandboxImageRef({
        regionOid,
        genesisImageId: instance.image.imageId,
        genesisVersionId: instance.image.versionId
      }),
      resolveSandboxSpecId({ regionOid, genesisSpecId: instance.spec.id })
    ]);

    return {
      object: 'sandbox.machine.instance' as const,

      id: instance.id,
      machine_id: machine.id,
      generation: instance.generation,
      status: instance.status as string,
      phase: instance.phase,
      creation_reason: instance.creationReason,

      image: { id: image.imageId, version_id: image.versionId },
      spec: {
        id: specId,
        identifier: instance.spec.identifier,
        memory_gib: instance.spec.memoryMiB / 1024,
        cpus: instance.spec.vcpus
      },

      operation: instance.operation
        ? {
            id: instance.operation.id,
            kind: instance.operation.kind as string,
            requested_at: instance.operation.requestedAt
          }
        : null,

      mounts: instance.mounts.map(mount => ({
        disk_id: mount.diskId,
        mount_path: mount.mountPath,
        status: mount.status
      })),

      disks_ready: instance.disksReady,
      runtime: instance.runtime
        ? {
            state: instance.runtime.state as string,
            setup: instance.runtime.setup.map(result => ({
              id: result.id,
              exit_code: result.exitCode,
              duration_ms: result.durationMs
            })),
            entrypoint: instance.runtime.entrypoint
              ? {
                  started_after_ms: instance.runtime.entrypoint.startedAfterMs,
                  exit_code: instance.runtime.entrypoint.exitCode,
                  signal: instance.runtime.entrypoint.signal
                }
              : null,
            error: instance.runtime.error
          }
        : null,

      failure: mapSandboxFailure(toRawFailure(instance.failure)),

      created_at: instance.createdAt,
      started_at: instance.startedAt,
      ready_at: instance.readyAt,
      paused_at: instance.pausedAt,
      terminated_at: instance.terminatedAt,
      last_seen_at: instance.lastSeenAt
    };
  })
  .schema(
    v.object({
      object: v.literal('sandbox.machine.instance', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The instance's unique identifier" }),
      machine_id: v.string({ description: 'The machine the instance belongs to' }),
      generation: v.number({
        description: 'The instance number within its machine, counting from one'
      }),
      status: v.string({ description: "The instance's detailed lifecycle status" }),
      phase: v.enumOf([...instancePhases], {
        description: "The instance's coarse lifecycle phase"
      }),
      creation_reason: v.nullable(
        v.string({ description: 'What caused the instance to be created' })
      ),

      image: v.object({
        id: sandboxReferenceSchema('The image the instance booted from'),
        version_id: sandboxReferenceSchema('The image version the instance booted from')
      }),
      spec: v.object({
        id: sandboxReferenceSchema('The spec the instance was created with'),
        identifier: v.string({ description: "The spec's human-readable identifier" }),
        memory_gib: v.number({ description: "The instance's memory in GiB" }),
        cpus: v.number({ description: "The instance's CPU count" })
      }),
      operation: v.nullable(
        v.object(
          {
            id: v.string(),
            kind: v.string(),
            requested_at: v.date()
          },
          { description: 'The operation currently acting on the instance, if any' }
        )
      ),
      mounts: v.array(
        v.object({
          disk_id: v.string(),
          mount_path: v.string(),
          status: v.enumOf(
            ['failed', 'pending', 'mounted', 'recovering', 'skipped', 'released'],
            {
              description: 'The mount status'
            }
          )
        }),
        { description: 'The disks mounted into the instance' }
      ),
      disks_ready: v.boolean({ description: 'Whether every required disk is mounted' }),
      runtime: v.nullable(
        v.object(
          {
            state: v.string({ description: 'The state of the workload runtime' }),
            setup: v.array(
              v.object({
                id: v.string(),
                exit_code: v.number(),
                duration_ms: v.number()
              })
            ),
            entrypoint: v.nullable(
              v.object({
                started_after_ms: v.nullable(v.number()),
                exit_code: v.nullable(v.number()),
                signal: v.nullable(v.string())
              })
            ),
            error: v.nullable(
              v.object(
                { code: v.string(), message: v.string() },
                { description: 'The error reported by the workload runtime, if any' }
              )
            )
          },
          { description: 'What the workload runtime inside the instance reported' }
        )
      ),

      failure: v.nullable(sandboxFailureSchema),
      has_logs: v.boolean({ description: 'Whether logs are available for the instance' }),

      created_at: v.date(),
      started_at: v.nullable(v.date()),
      ready_at: v.nullable(v.date()),
      paused_at: v.nullable(v.date()),
      terminated_at: v.nullable(v.date()),
      last_seen_at: v.nullable(
        v.date({ description: 'When the instance last reported being alive' })
      )
    })
  )
  .build();
