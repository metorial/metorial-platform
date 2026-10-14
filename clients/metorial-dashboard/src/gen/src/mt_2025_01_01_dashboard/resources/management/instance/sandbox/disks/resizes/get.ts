import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxDisksResizesGetOutput = {
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

export let mapManagementInstanceSandboxDisksResizesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxDisksResizesGetOutput>(
    [
      'disk_id',
      'original_size_bytes',
      'target_size_bytes',
      'machine_ids',
      'created_at',
      'updated_at',
      'completed_at'
    ],
    1
  );
