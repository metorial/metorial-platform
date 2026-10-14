import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxDiskType } from '../../types';
import { toNumber } from './_shared';

export let v1SandboxDiskPresenter = Presenter.create(sandboxDiskType)
  .presenter(async ({ disk }) => {
    let remote = disk.remote;
    if (!remote) throw new Error(`Sandbox disk ${disk.id} is unavailable in its region`);

    return {
      object: 'sandbox.disk' as const,

      id: disk.id,
      type: disk.type,
      name: remote.name,
      status: remote.status,
      region: disk.tenant.region.identifier,
      size_bytes: toNumber(remote.sizeBytes),

      machine: remote.machine
        ? {
            id: remote.machine.machineId,
            mount_path: remote.machine.mountPath
          }
        : null,
      active_resize: remote.resize
        ? {
            id: remote.resize.id,
            status: remote.resize.status as string,
            target_size_bytes: toNumber(remote.resize.targetSizeBytes)
          }
        : null,

      created_at: disk.createdAt,
      updated_at: disk.updatedAt,
      deleted_at: disk.deletedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('sandbox.disk', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The disk's unique identifier" }),
      type: v.enumOf(['standard', 'root_fs'], {
        description:
          'Standard disks are managed by you. Root filesystem disks belong to a machine.'
      }),
      name: v.nullable(v.string({ description: "The disk's name" })),
      status: v.enumOf(['active', 'cloning', 'deleting', 'deleted', 'sealed'], {
        description: "The disk's status"
      }),
      region: v.string({ description: 'The identifier of the region the disk lives in' }),
      size_bytes: v.number({ description: "The disk's capacity in bytes" }),

      machine: v.nullable(
        v.object(
          {
            id: v.string({ description: 'The machine the disk is attached to' }),
            mount_path: v.string({ description: 'Where the machine mounts the disk' })
          },
          { description: 'The machine the disk is attached to, if any' }
        )
      ),
      active_resize: v.nullable(
        v.object(
          {
            id: v.string(),
            status: v.string({ description: 'The status of the resize' }),
            target_size_bytes: v.number()
          },
          { description: 'The resize currently in progress, if any' }
        )
      ),

      created_at: v.date(),
      updated_at: v.date(),
      deleted_at: v.nullable(v.date())
    })
  )
  .build();
