import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxDisksResizesRetryOutput = {
  object: 'sandbox.disk.resize';
  id: string;
  diskId: string;
  status:
    | 'pending'
    | 'draining'
    | 'resizing'
    | 'verifying'
    | 'restarting'
    | 'complete'
    | 'failed';
  originalSizeBytes: number;
  targetSizeBytes: number;
  machineIds: string[];
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
  updatedAt: Date;
  completedAt: Date | null;
};

export let mapSandboxDisksResizesRetryOutput =
  mtMap.object<SandboxDisksResizesRetryOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    diskId: mtMap.objectField('disk_id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    originalSizeBytes: mtMap.objectField(
      'original_size_bytes',
      mtMap.passthrough()
    ),
    targetSizeBytes: mtMap.objectField(
      'target_size_bytes',
      mtMap.passthrough()
    ),
    machineIds: mtMap.objectField(
      'machine_ids',
      mtMap.array(mtMap.passthrough())
    ),
    failure: mtMap.objectField(
      'failure',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    completedAt: mtMap.objectField('completed_at', mtMap.date())
  });

