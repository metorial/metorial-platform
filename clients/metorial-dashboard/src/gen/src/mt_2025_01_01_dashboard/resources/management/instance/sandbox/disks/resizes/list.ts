import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxDisksResizesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSandboxDisksResizesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxDisksResizesListOutput>(
    [
      7,
      [
        1,
        [
          'disk_id',
          'original_size_bytes',
          'target_size_bytes',
          'machine_ids',
          'created_at',
          'updated_at',
          'completed_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSandboxDisksResizesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'pending'
    | 'draining'
    | 'resizing'
    | 'verifying'
    | 'restarting'
    | 'complete'
    | 'failed'
    | (
        | 'pending'
        | 'draining'
        | 'resizing'
        | 'verifying'
        | 'restarting'
        | 'complete'
        | 'failed'
      )[]
    | undefined;
};

export let mapManagementInstanceSandboxDisksResizesListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxDisksResizesListQuery>(
    0
  );
