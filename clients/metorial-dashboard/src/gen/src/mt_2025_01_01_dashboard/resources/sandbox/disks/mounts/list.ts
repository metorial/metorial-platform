import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SandboxDisksMountsListOutput = {
  items: {
    object: 'sandbox.disk.mount';
    id: string;
    diskId: string;
    machineId: string | null;
    machineInstanceId: string | null;
    mountPath: string;
    status:
      'failed' | 'pending' | 'mounted' | 'recovering' | 'skipped' | 'released';
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
    mountedAt: Date | null;
    releasedAt: Date | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSandboxDisksMountsListOutput =
  /* @__PURE__ */ createMapper<SandboxDisksMountsListOutput>(
    [
      7,
      [
        1,
        [
          'disk_id',
          'machine_id',
          'machine_instance_id',
          'mount_path',
          'mounted_at',
          'released_at',
          'created_at'
        ]
      ]
    ],
    1
  );

export type SandboxDisksMountsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSandboxDisksMountsListQuery =
  /* @__PURE__ */ createMapper<SandboxDisksMountsListQuery>(0);
