import { v } from '@lowerdeck/validation';
import { mapSandboxFailure } from '@metorial/module-sandbox';
import { Presenter } from '@metorial/presenter';
import { sandboxDiskResizeType } from '../../types';
import { sandboxFailureSchema, toNumber, toRawFailure } from './_shared';

export let v1SandboxDiskResizePresenter = Presenter.create(sandboxDiskResizeType)
  .presenter(async ({ resize }) => ({
    object: 'sandbox.disk.resize' as const,

    id: resize.id,
    disk_id: resize.diskId,
    status: resize.status,
    original_size_bytes: toNumber(resize.originalSizeBytes),
    target_size_bytes: toNumber(resize.targetSizeBytes),
    machine_ids: resize.machines.map(machine => machine.machineId),
    failure: mapSandboxFailure(toRawFailure(resize.failure)),

    created_at: resize.createdAt,
    updated_at: resize.updatedAt,
    completed_at: resize.completedAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.disk.resize', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The resize's unique identifier" }),
      disk_id: v.string({ description: 'The disk being resized' }),
      status: v.enumOf(
        ['pending', 'draining', 'resizing', 'verifying', 'restarting', 'complete', 'failed'],
        { description: "The resize's status" }
      ),
      original_size_bytes: v.number({ description: 'The disk size before the resize' }),
      target_size_bytes: v.number({ description: 'The disk size the resize works toward' }),
      machine_ids: v.array(v.string(), {
        description: 'The machines that are stopped and restarted for the resize'
      }),
      failure: v.nullable(sandboxFailureSchema),

      created_at: v.date(),
      updated_at: v.date(),
      completed_at: v.nullable(v.date())
    })
  )
  .build();
