import { v } from '@lowerdeck/validation';
import { mapSandboxFailure } from '@metorial/module-sandbox';
import { Presenter } from '@metorial/presenter';
import { sandboxDiskMountType } from '../../types';
import { sandboxFailureSchema, toRawFailure } from './_shared';

export let v1SandboxDiskMountPresenter = Presenter.create(sandboxDiskMountType)
  .presenter(async ({ mount }) => ({
    object: 'sandbox.disk.mount' as const,

    id: mount.id,
    disk_id: mount.diskId,
    machine_id: mount.machineId,
    machine_instance_id: mount.instanceId,
    mount_path: mount.mountPath,
    status: mount.status,
    failure: mapSandboxFailure(toRawFailure(mount.failure)),

    mounted_at: mount.mountedAt,
    released_at: mount.releasedAt,
    created_at: mount.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.disk.mount', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The mount's unique identifier" }),
      disk_id: v.string({ description: 'The mounted disk' }),
      machine_id: v.nullable(
        v.string({ description: 'The machine the disk was mounted for' })
      ),
      machine_instance_id: v.nullable(
        v.string({ description: 'The machine instance the disk was mounted into' })
      ),
      mount_path: v.string({ description: 'Where the disk was mounted' }),
      status: v.enumOf(['failed', 'pending', 'mounted', 'recovering', 'skipped', 'released'], {
        description: "The mount's status"
      }),
      failure: v.nullable(sandboxFailureSchema),

      mounted_at: v.nullable(v.date()),
      released_at: v.nullable(v.date()),
      created_at: v.date()
    })
  )
  .build();
